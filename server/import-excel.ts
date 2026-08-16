import ExcelJS from 'exceljs';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { db, contactoRepo, runMigrations, type ContactoRow, usuarioRepo } from './db.js';
import { EXCEL_PATH } from './paths.js';

const PAISES_HOJAS = {
  'Argentina': { pais: 'Argentina', tipo: 'movil' },
  'Colombia': { pais: 'Colombia', tipo: 'movil' },
  'Costa Rica': { pais: 'Costa Rica', tipo: 'movil' },
  'España': { pais: 'España', tipo: 'movil' },
  'España (Fijos)': { pais: 'España', tipo: 'fijo' },
  'Mexico': { pais: 'Mexico', tipo: 'movil' },
  'Panama': { pais: 'Panama', tipo: 'movil' },
  'Uruguay': { pais: 'Uruguay', tipo: 'movil' },
};

const HOJAS_IGNORAR = ['Resumen', 'Seguimiento Diario'];

// Obtener lista de usuarios agentes para asignación
function getAgenteIds(): number[] {
  const agentes = usuarioRepo.findAll.all() as Array<{ id: number; rol: string }>;
  return agentes.filter(u => u.rol === 'agente').map(u => u.id);
}

function parseBool(val: any): 0 | 1 | null {
  if (val === true || val === 'TRUE' || val === 'True' || val === 'true' || val === 1 || val === '1') return 1;
  if (val === false || val === 'FALSE' || val === 'False' || val === 'false' || val === 0 || val === '0') return 0;
  return null; // Vacío = NULL
}

function parseClasificacionLlamada(val: any): 'Bien' | 'Normal' | 'Mal' | null {
  // La nueva clasificación (Bien/Normal/Mal) empieza vacía - no mapear desde la antigua
  return null;
}

function normalizarTelefono(tel: unknown): string | null {
  if (!tel) return null;
  const limpio = tel.toString().trim();
  if (!limpio || limpio.toLowerCase() === 'sin numero' || limpio.toLowerCase() === 'sin número') return null;
  return limpio;
}

async function importarHojaPais(workbook: ExcelJS.Workbook, hojaNombre: string, agenteIds: number[]) {
  const config = PAISES_HOJAS[hojaNombre as keyof typeof PAISES_HOJAS];
  if (!config) {
    console.log(`  ⚠ Hoja "${hojaNombre}" no reconocida, saltando...`);
    return { insertados: 0, actualizados: 0 };
  }

  const worksheet = workbook.getWorksheet(hojaNombre);
  if (!worksheet) {
    console.log(`  ⚠ Hoja "${hojaNombre}" no encontrada, saltando...`);
    return { insertados: 0, actualizados: 0 };
  }

  console.log(`\n📥 Importando ${hojaNombre} (${config.pais} - ${config.tipo})...`);

  let insertados = 0;
  let actualizados = 0;
  let rowIndex = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Saltar header

    const nombre = row.getCell(1).value?.toString().trim() || '';
    const empresa = row.getCell(2).value?.toString().trim() || null;
    const website = row.getCell(3).value?.toString().trim() || null;
    const telefonoRaw = row.getCell(4).value;
    const telefono = normalizarTelefono(telefonoRaw);

    // Si no tiene teléfono válido, saltar (van en Sin Numero)
    if (!telefono) return;

    const contesto = parseBool(row.getCell(5).value);
    const no_contesto = parseBool(row.getCell(6).value);
    const interesado = parseBool(row.getCell(7).value);
    const agendo = parseBool(row.getCell(8).value);
    const cerrado = parseBool(row.getCell(9).value);
    const clasificacionAntigua = row.getCell(10).value?.toString().trim() || null; // Tradicional/Lujo/etc
    const nota = row.getCell(11).value?.toString().trim() || null;

    // Asignar contactos round-robin entre agentes
    const agenteId = agenteIds[rowIndex % agenteIds.length];
    rowIndex++;

    // Verificar si ya existe por teléfono
    const existente = contactoRepo.findByTelefono.get(telefono);

    if (existente) {
      // Actualizar (incluir asignado_a para distribuir entre agentes)
      contactoRepo.update.run(
        nombre,
        empresa,
        website,
        telefono,
        config.pais,
        config.tipo,
        contesto ?? existente.contesto,
        no_contesto ?? existente.no_contesto,
        interesado ?? existente.interesado,
        0, // rechazado no estaba en Excel original
        agendo ?? existente.agendo,
        cerrado ?? existente.cerrado,
        0, // email
        0, // whatsapp
        existente.clasificacion, // mantener clasificación de llamada (Bien/Normal/Mal)
        nota ?? existente.nota,
        existente.fecha_ultimo_contacto,
        agenteId, // Asignar agente round-robin
        existente.id
      );
      actualizados++;
    } else {
      // Insertar nuevo con asignado_a
      db.prepare(`
        INSERT INTO contactos (nombre, empresa, website, telefono, pais, tipo_telefono,
          contesto, no_contesto, interesado, rechazado, agendo, cerrado,
          info_enviada_email, info_enviada_whatsapp, clasificacion, nota, fecha_ultimo_contacto, asignado_a)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nombre,
        empresa,
        website,
        telefono,
        config.pais,
        config.tipo,
        contesto ?? 0,
        no_contesto ?? 0,
        interesado ?? 0,
        0, // rechazado
        agendo ?? 0,
        cerrado ?? 0,
        0, // email
        0, // whatsapp
        null, // clasificación de llamada (nueva, empieza vacía)
        nota,
        null, // fecha_ultimo_contacto
        agenteId
      );
      insertados++;
    }
  });

  console.log(`  ✅ ${insertados} insertados, ${actualizados} actualizados`);
  return { insertados, actualizados };
}

async function importarSinNumero(workbook: ExcelJS.Workbook, agenteIds: number[]) {
  const worksheet = workbook.getWorksheet('Sin Numero');
  if (!worksheet) {
    console.log('\n⚠ Hoja "Sin Numero" no encontrada');
    return { insertados: 0, actualizados: 0 };
  }

  console.log('\n📥 Importando Sin Numero...');

  let insertados = 0;
  let actualizados = 0;
  let rowIndex = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const pais = row.getCell(1).value?.toString().trim() || '';
    const nombre = row.getCell(2).value?.toString().trim() || '';
    const empresa = row.getCell(3).value?.toString().trim() || null;
    const website = row.getCell(4).value?.toString().trim() || null;
    const estado = row.getCell(5).value?.toString().trim() || null;

    if (!nombre || !pais) return;

    // Asignar round-robin
    const agenteId = agenteIds[rowIndex % agenteIds.length];
    rowIndex++;

    // Para sin número, usar nombre+pais+empresa como clave única aproximada
    const existente = db.prepare(
      "SELECT * FROM contactos WHERE tipo_telefono = 'sin_numero' AND nombre = ? AND pais = ? AND (empresa = ? OR (empresa IS NULL AND ? IS NULL))"
    ).get(nombre, pais, empresa, empresa) as ContactoRow | undefined;

    if (existente) {
      db.prepare(`
        UPDATE contactos SET empresa = ?, website = ?, nota = ?, asignado_a = ?
        WHERE id = ?
      `).run(empresa, website, estado, agenteId, existente.id);
      actualizados++;
    } else {
      db.prepare(`
        INSERT INTO contactos (nombre, empresa, website, telefono, pais, tipo_telefono, nota, asignado_a)
        VALUES (?, ?, ?, NULL, ?, 'sin_numero', ?, ?)
      `).run(nombre, empresa, website, pais, estado, agenteId);
      insertados++;
    }
  });

  console.log(`  ✅ ${insertados} insertados, ${actualizados} actualizados`);
  return { insertados, actualizados };
}

export async function importarExcel() {
  console.log('🚀 Iniciando importación del Excel...');
  console.log(`📁 Archivo: ${EXCEL_PATH}`);

  if (!existsSync(EXCEL_PATH)) {
    throw new Error(`No se encuentra el archivo Excel en: ${EXCEL_PATH}`);
  }

  runMigrations();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  console.log(`📊 Hojas encontradas: ${workbook.worksheets.map(w => w.name).join(', ')}`);

  const agenteIds = getAgenteIds();
  if (agenteIds.length === 0) {
    console.log('⚠ No hay agentes para asignar contactos');
    return { insertados: 0, actualizados: 0 };
  }
  console.log(`👥 Agentes disponibles: ${agenteIds.length}`);

  let totalInsertados = 0;
  let totalActualizados = 0;

  // Importar hojas de países
  for (const hojaNombre of workbook.worksheets.map(w => w.name)) {
    if (HOJAS_IGNORAR.includes(hojaNombre)) continue;
    if (hojaNombre === 'Sin Numero') continue;

    const resultado = await importarHojaPais(workbook, hojaNombre, agenteIds);
    totalInsertados += resultado.insertados;
    totalActualizados += resultado.actualizados;
  }

  // Importar Sin Numero
  const resultadoSinNumero = await importarSinNumero(workbook, agenteIds);
  totalInsertados += resultadoSinNumero.insertados;
  totalActualizados += resultadoSinNumero.actualizados;

  // Estadísticas finales
  const stats = db.prepare(`
    SELECT
      tipo_telefono,
      COUNT(*) as total
    FROM contactos
    GROUP BY tipo_telefono
  `).all() as Array<{ tipo_telefono: string; total: number }>;

  const porPais = db.prepare(`
    SELECT pais, tipo_telefono, COUNT(*) as total
    FROM contactos
    GROUP BY pais, tipo_telefono
    ORDER BY pais, tipo_telefono
  `).all() as Array<{ pais: string; tipo_telefono: string; total: number }>;

  console.log('\n📈 RESUMEN FINAL:');
  console.log(`  Insertados: ${totalInsertados}`);
  console.log(`  Actualizados: ${totalActualizados}`);
  console.log(`  Total en BD: ${totalInsertados + totalActualizados}`);
  console.log('\n  Por tipo:');
  for (const s of stats) {
    console.log(`    ${s.tipo_telefono}: ${s.total}`);
  }
  console.log('\n  Por país:');
  for (const p of porPais) {
    console.log(`    ${p.pais} (${p.tipo_telefono}): ${p.total}`);
  }

  return { insertados: totalInsertados, actualizados: totalActualizados };
}

// Permitir ejecución directa (comparación robusta de rutas absolutas, funciona en Windows)
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  importarExcel()
    .then(() => {
      console.log('\n✨ Importación completada');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Error:', err);
      process.exit(1);
    });
}