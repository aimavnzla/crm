import { db, eventoRepo, contactoRepo } from './db.js';
import type { EventoRow } from './db.js';
import { obtenerFechaVenezuela, obtenerInicioSemana, obtenerFinSemana, obtenerInicioMes, obtenerFinMes, toDateTimeString } from './date.js';

export interface MetricasPeriodo {
  periodo: 'hoy' | 'semana' | 'mes';
  llamadas_realizadas: number;
  contestaron: number;
  no_contestaron: number;
  tasa_contestacion: number;
  interesados: number;
  tasa_interesados: number;
  agendaron: number;
  tasa_agenda: number;
  cerraron: number;
  tasa_cierre: number;
  /** Contactos en seguimiento (interesado=1 o agendo=1), estado actual (no período). */
  en_seguimiento: number;
  seguimiento_info_enviada: number;
  seguimiento_respondio: number;
  por_pais: Array<{
    pais: string;
    llamadas: number;
    contestaron: number;
    no_contestaron: number;
    interesados: number;
    agendaron: number;
    cerraron: number;
  }>;
}

export interface LlamadasPorDia {
  dia: string;
  total: number;
}

function getRangoFechas(periodo: 'hoy' | 'semana' | 'mes'): { inicio: Date; fin: Date } {
  const ahora = obtenerFechaVenezuela();

  switch (periodo) {
    case 'hoy': {
      const inicio = new Date(ahora);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(ahora);
      fin.setHours(23, 59, 59, 999);
      return { inicio, fin };
    }
    case 'semana':
      return { inicio: obtenerInicioSemana(ahora), fin: obtenerFinSemana(ahora) };
    case 'mes':
      return { inicio: obtenerInicioMes(ahora), fin: obtenerFinMes(ahora) };
  }
}

interface EventoConPais extends EventoRow {
  pais?: string;
  tipo_telefono?: string;
}

// Una "llamada" = un contacto en una fecha. Deduplicar así evita que toggles
// de la misma llamada (contesto→no_contesto→contesto) inflen el total.
function esLlamada(e: EventoRow): boolean {
  return e.tipo === 'contesto' || e.tipo === 'no_contesto';
}
function keyLlamada(e: EventoRow): string {
  return `${e.contacto_id}|${e.timestamp.slice(0, 10)}`;
}

export async function calcularMetricas(periodo: 'hoy' | 'semana' | 'mes', userId?: number): Promise<MetricasPeriodo> {
  const { inicio, fin } = getRangoFechas(periodo);
  const inicioStr = toDateTimeString(inicio);
  const finStr = toDateTimeString(fin);

  // Métricas globales (BD compartida - todos ven lo mismo)
  // userId se ignora porque todos trabajan la misma base de datos
  const eventos = (await eventoRepo.findAllByDateRange.all(inicioStr, finStr)) as EventoConPais[];

  // Llamadas realizadas: contactos únicos por día (no cuenta toggles repetidos)
  const llamadasRealizadas = new Set(eventos.filter(esLlamada).map(keyLlamada)).size;

  // Resultados: contactos únicos con cada evento (no eventos crudos)
  const contestaron = new Set(eventos.filter(e => e.tipo === 'contesto' && e.valor === 1).map(e => e.contacto_id)).size;
  const noContestaron = new Set(eventos.filter(e => e.tipo === 'no_contesto' && e.valor === 1).map(e => e.contacto_id)).size;
  // Interesados/agendaron/cerraron cuentan TODOS los eventos del período,
  // sin exigir que el contesto haya ocurrido en el mismo período (antes esto
  // hacía que "agendó hoy" no marcara nada si el contesto fue de otro día).
  const interesados = new Set(eventos.filter(e => e.tipo === 'interesado' && e.valor === 1).map(e => e.contacto_id)).size;
  const agendaron = new Set(eventos.filter(e => e.tipo === 'agendo' && e.valor === 1).map(e => e.contacto_id)).size;
  const cerraron = new Set(eventos.filter(e => e.tipo === 'cerrado' && e.valor === 1).map(e => e.contacto_id)).size;

  // Por país (misma lógica de deduplicación)
  interface PaisAgg {
    pais: string;
    llamadasKeys: Set<string>;
    contestaron: Set<number>;
    noContestaron: Set<number>;
    interesados: Set<number>;
    agendaron: Set<number>;
    cerraron: Set<number>;
  }
  const porPaisMap = new Map<string, PaisAgg>();
  for (const e of eventos) {
    const pais = e.pais;
    if (!pais) continue;
    let agg = porPaisMap.get(pais);
    if (!agg) {
      agg = { pais, llamadasKeys: new Set(), contestaron: new Set(), noContestaron: new Set(), interesados: new Set(), agendaron: new Set(), cerraron: new Set() };
      porPaisMap.set(pais, agg);
    }
    if (esLlamada(e)) agg.llamadasKeys.add(keyLlamada(e));
    if (e.tipo === 'contesto' && e.valor === 1) agg.contestaron.add(e.contacto_id);
    else if (e.tipo === 'no_contesto' && e.valor === 1) agg.noContestaron.add(e.contacto_id);
    else if (e.tipo === 'interesado' && e.valor === 1) agg.interesados.add(e.contacto_id);
    else if (e.tipo === 'agendo' && e.valor === 1) agg.agendaron.add(e.contacto_id);
    else if (e.tipo === 'cerrado' && e.valor === 1) agg.cerraron.add(e.contacto_id);
  }

  const porPais = Array.from(porPaisMap.values()).map(a => ({
    pais: a.pais,
    llamadas: a.llamadasKeys.size,
    contestaron: a.contestaron.size,
    no_contestaron: a.noContestaron.size,
    interesados: a.interesados.size,
    agendaron: a.agendaron.size,
    cerraron: a.cerraron.size,
  })).sort((a, b) => b.llamadas - a.llamadas);

  // Seguimiento: estado ACTUAL de los contactos en seguimiento (no depende del período)
  // userId se ignora - métricas globales
  const segQuery = `
    SELECT
      COUNT(*) AS en_seguimiento,
      COALESCE(SUM(CASE WHEN seguimiento_envio = 1 THEN 1 ELSE 0 END), 0) AS info_enviada,
      COALESCE(SUM(CASE WHEN seguimiento_respuesta = 1 THEN 1 ELSE 0 END), 0) AS respondio
    FROM contactos
    WHERE interesado = 1 OR agendo = 1
  `;
  const seg = (await db.execute({ sql: segQuery, args: [] })).rows[0] as { en_seguimiento: number; info_enviada: number; respondio: number };

  const tasaContestacion = llamadasRealizadas > 0 ? Math.round((contestaron / llamadasRealizadas) * 100) : 0;
  const tasaInteresados = contestaron > 0 ? Math.round((interesados / contestaron) * 100) : 0;
  const tasaAgenda = contestaron > 0 ? Math.round((agendaron / contestaron) * 100) : 0;
  const tasaCierre = contestaron > 0 ? Math.round((cerraron / contestaron) * 100) : 0;

  return {
    periodo,
    llamadas_realizadas: llamadasRealizadas,
    contestaron,
    no_contestaron: noContestaron,
    tasa_contestacion: tasaContestacion,
    interesados,
    tasa_interesados: tasaInteresados,
    agendaron,
    tasa_agenda: tasaAgenda,
    cerraron,
    tasa_cierre: tasaCierre,
    en_seguimiento: seg?.en_seguimiento ?? 0,
    seguimiento_info_enviada: seg?.info_enviada ?? 0,
    seguimiento_respondio: seg?.respondio ?? 0,
    por_pais: porPais,
  };
}

export async function calcularSerieLlamadas(dias: number = 14, userId?: number): Promise<LlamadasPorDia[]> {
  const fin = obtenerFechaVenezuela();
  const inicio = new Date(fin);
  inicio.setDate(fin.getDate() - dias + 1);
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(23, 59, 59, 999);

  const inicioISO = toDateTimeString(inicio);
  const finISO = toDateTimeString(fin);

  // Métricas globales (BD compartida)
  const eventos = (await eventoRepo.findAllByDateRange.all(inicioISO, finISO)) as EventoRow[];

  // Contactos únicos por día (dedup: toggles de la misma llamada no suman doble)
  const porDia = new Map<string, Set<string>>();
  for (const e of eventos) {
    if (!esLlamada(e)) continue;
    const dia = e.timestamp.slice(0, 10);
    if (!porDia.has(dia)) porDia.set(dia, new Set());
    porDia.get(dia)!.add(String(e.contacto_id));
  }

  // Rellenar días sin datos (clave local, igual que el timestamp de los eventos)
  const resultado: LlamadasPorDia[] = [];
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const key = toDateTimeString(d).slice(0, 10);
    resultado.push({ dia: key, total: porDia.get(key)?.size || 0 });
  }

  return resultado;
}