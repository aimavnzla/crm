import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { db, type ContactoRow } from './db.js';

// Enriquecimiento: para los contactos con teléfono FIJO, visita su website,
// extrae el WhatsApp que publican (enlaces wa.me / api.whatsapp.com) y lo guarda
// en la columna `whatsapp`. Si la web no publica WhatsApp pero sí un móvil (6XX),
// lo anota en la nota del contacto. Las webs caídas o dinámicas se saltan.

const TIEMPO_ESPERA_MS = 12000;
const CONCURRENCIA = 6;
const MAX_HTML = 2_000_000;

const argLimite = process.argv.find(a => a.startsWith('--limite='));
const LIMITE = argLimite ? parseInt(argLimite.split('=')[1]) || 0 : 0;

function normalizarNumero(raw: string): string | null {
  const dig = raw.replace(/\D/g, '');
  if (!dig) return null;
  if (dig.length === 9 && /^[679]/.test(dig)) return '+34' + dig; // número nacional español
  if (dig.length === 11 && dig.startsWith('34')) return '+' + dig; // ya con código país
  if (dig.length <= 8) return null; // ruido (años, IDs, etc.)
  return '+' + dig;
}

// WhatsApp explícito publicado (botón/ícono/link de WhatsApp)
function extraerWhatsappExplicito(html: string): string | null {
  const waMe = html.match(/wa\.me\/(\d+)/i);
  if (waMe) return normalizarNumero(waMe[1]);

  const api = html.match(/api\.whatsapp\.com\/send\?phone=(\+?\d+)/i);
  if (api) return normalizarNumero(api[1]);

  return null;
}

// Móvil español publicado (6 o 7 + 8 dígitos), con o sin +34
function extraerMovil(html: string): string | null {
  const m = html.match(/(?<![\d.])(\+34[\s.-]?)?([67]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})(?!\d)/);
  if (!m) return null;
  return normalizarNumero((m[1] ?? '') + m[2]);
}

async function descargar(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIEMPO_ESPERA_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'es,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > MAX_HTML ? text.slice(0, MAX_HTML) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Intenta http; si falla, prueba https
async function descargarConFallback(url: string): Promise<string | null> {
  let html = await descargar(url);
  if (html === null && url.startsWith('http://')) {
    html = await descargar('https://' + url.slice('http://'.length));
  }
  return html;
}

type Resultado = 'whatsapp' | 'movil' | 'sin' | 'fallo';

async function procesar(c: ContactoRow): Promise<Resultado> {
  const html = await descargarConFallback(c.website!);
  if (html === null) return 'fallo';

  const wa = extraerWhatsappExplicito(html);
  const movil = extraerMovil(html);
  const telDig = (c.telefono ?? '').replace(/\D/g, '');
  const movilUtil = movil && movil.replace(/\D/g, '') !== telDig ? movil : null;

  if (wa) {
    db.prepare('UPDATE contactos SET whatsapp = ? WHERE id = ?').run(wa, c.id);
    return 'whatsapp';
  }

  if (movilUtil) {
    const linea = `Móvil web: ${movilUtil}`;
    const nota = c.nota && !c.nota.includes('Móvil web:') ? `${c.nota}\n${linea}` : (c.nota ?? linea);
    db.prepare('UPDATE contactos SET nota = ? WHERE id = ?').run(nota, c.id);
    return 'movil';
  }

  return 'sin';
}

export async function enriquecerWhatsapp(): Promise<void> {
  const base =
    "SELECT * FROM contactos WHERE tipo_telefono = 'fijo' AND website IS NOT NULL AND website != '' AND (whatsapp IS NULL OR whatsapp = '')";
  const lista = (LIMITE > 0 ? db.prepare(base + ' LIMIT ?').all(LIMITE) : db.prepare(base).all()) as ContactoRow[];

  console.log(`🔍 Enriquecimiento de WhatsApp`);
  console.log(`📇 Contactos fijos con web por revisar: ${lista.length}${LIMITE > 0 ? ` (límite ${LIMITE})` : ''}`);
  console.log(`🌐 Concurrencia: ${CONCURRENCIA} · timeout: ${TIEMPO_ESPERA_MS / 1000}s`);

  const resumen = { whatsapp: 0, movil: 0, sin: 0, fallo: 0 };
  let procesados = 0;

  async function trabajador() {
    while (true) {
      const c = lista.shift();
      if (!c) return;
      const r = await procesar(c);
      resumen[r]++;
      procesados++;
      if (procesados % 50 === 0) {
        console.log(`  ${procesados}/${lista.length + procesados} procesados...`);
      }
    }
  }

  const total = lista.length;
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

  console.log('\n📈 RESUMEN:');
  console.log(`  ✅ WhatsApp encontrado: ${resumen.whatsapp}`);
  console.log(`  📱 Móvil anotado en nota: ${resumen.movil}`);
  console.log(`  ⚪ Sin número publicable: ${resumen.sin}`);
  console.log(`  ❌ Web caída/dinámica: ${resumen.fallo}`);
  console.log(`  Total revisadas: ${procesados}/${total}`);

  const conWhatsapp = db.prepare('SELECT COUNT(*) as t FROM contactos WHERE whatsapp IS NOT NULL AND whatsapp != \'\'').get() as { t: number };
  console.log(`  Total en BD con WhatsApp: ${conWhatsapp.t}`);
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  enriquecerWhatsapp()
    .then(() => {
      console.log('\n✨ Enriquecimiento completado');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Error:', err);
      process.exit(1);
    });
}
