import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './paths.js';
import { nowLocalString } from './date.js';

// Cliente Turso (libSQL) - funciona en Vercel y local
// Requiere variables de entorno: TURSO_URL y TURSO_TOKEN
const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;

let db: any;

if (TURSO_URL && TURSO_TOKEN) {
  // Producción en Vercel con Turso
  db = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });
} else {
  // Desarrollo local con SQLite (better-sqlite3 compatible via libsql)
  // Usamos file: para SQLite local
  const localDbPath = join(DATA_DIR, 'aima.db');
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  db = createClient({
    url: `file:${localDbPath}`,
  });
}

// Helper para ejecutar queries (libSQL usa .execute() en lugar de .prepare().run())
async function run(sql: string, params: any[] = []) {
  const result = await db.execute({ sql, args: params });
  return {
    lastInsertRowid: result.lastInsertRowid,
    changes: result.rowsAffected,
  };
}

async function get(sql: string, params: any[] = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows[0] ?? undefined;
}

async function all(sql: string, params: any[] = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

async function exec(sql: string) {
  await db.executeMultiple(sql);
}

// WAL mode no aplica en libSQL/Turso (usa replicación)
// foreign_keys sí aplica
await exec('PRAGMA foreign_keys = ON');

// Ejecutar migraciones INMEDIATAMENTE al cargar el módulo
await runMigrations();

// Migraciones
export async function runMigrations() {
  // Tabla usuarios
  await exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'agente' CHECK (rol IN ('admin', 'agente')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla contactos
  await exec(`
    CREATE TABLE IF NOT EXISTS contactos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      empresa TEXT,
      website TEXT,
      telefono TEXT,
      pais TEXT NOT NULL,
      tipo_telefono TEXT NOT NULL CHECK (tipo_telefono IN ('movil', 'fijo', 'sin_numero')),
      contesto INTEGER DEFAULT 0,
      no_contesto INTEGER DEFAULT 0,
      interesado INTEGER DEFAULT 0,
      rechazado INTEGER DEFAULT 0,
      agendo INTEGER DEFAULT 0,
      cerrado INTEGER DEFAULT 0,
      info_enviada_email INTEGER DEFAULT 0,
      info_enviada_whatsapp INTEGER DEFAULT 0,
      clasificacion TEXT CHECK (clasificacion IN ('Bien', 'Normal', 'Mal')),
      nota TEXT,
      fecha_ultimo_contacto DATE,
      asignado_a INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asignado_a) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `);

  // Tabla eventos_llamada
  await exec(`
    CREATE TABLE IF NOT EXISTS eventos_llamada (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contacto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('contesto', 'no_contesto', 'interesado', 'rechazado', 'agendo', 'cerrado', 'email', 'whatsapp')),
      valor INTEGER NOT NULL CHECK (valor IN (0, 1)),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE
    )
  `);

  // Migración: columna whatsapp
  const columnas = (await all('PRAGMA table_info(contactos)')) as Array<{ name: string }>;
  if (!columnas.some(c => c.name === 'whatsapp')) {
    await exec('ALTER TABLE contactos ADD COLUMN whatsapp TEXT');
  }

  // Migración: columna asignado_a (multi-usuario)
  if (!columnas.some(c => c.name === 'asignado_a')) {
    await exec('ALTER TABLE contactos ADD COLUMN asignado_a INTEGER REFERENCES usuarios(id) ON DELETE SET NULL');
  }

  // Migración: seguimiento de interesados/agendaron
  if (!columnas.some(c => c.name === 'seguimiento_envio')) {
    await exec('ALTER TABLE contactos ADD COLUMN seguimiento_envio INTEGER DEFAULT 0');
  }
  if (!columnas.some(c => c.name === 'seguimiento_respuesta')) {
    await exec('ALTER TABLE contactos ADD COLUMN seguimiento_respuesta INTEGER DEFAULT 0');
  }

  // Tabla cola_dia
  await exec(`
    CREATE TABLE IF NOT EXISTS cola_dia (
      fecha TEXT NOT NULL,
      posicion INTEGER NOT NULL,
      contacto_id INTEGER NOT NULL,
      bloque_nombre TEXT NOT NULL,
      PRIMARY KEY (fecha, posicion),
      FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE
    )
  `);

  // Tabla cola_dia_usuario: cola por usuario
  await exec(`
    CREATE TABLE IF NOT EXISTS cola_dia_usuario (
      fecha TEXT NOT NULL,
      usuario_id INTEGER NOT NULL,
      posicion INTEGER NOT NULL,
      contacto_id INTEGER NOT NULL,
      bloque_nombre TEXT NOT NULL,
      PRIMARY KEY (fecha, usuario_id, posicion),
      FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Índices
  await exec(`
    CREATE INDEX IF NOT EXISTS idx_contactos_pais_tipo ON contactos(pais, tipo_telefono);
    CREATE INDEX IF NOT EXISTS idx_contactos_fecha_contacto ON contactos(fecha_ultimo_contacto);
    CREATE INDEX IF NOT EXISTS idx_contactos_telefono ON contactos(telefono);
    CREATE INDEX IF NOT EXISTS idx_contactos_asignado ON contactos(asignado_a);
    CREATE INDEX IF NOT EXISTS idx_eventos_contacto_fecha ON eventos_llamada(contacto_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_eventos_tipo_fecha ON eventos_llamada(tipo, timestamp);
    CREATE INDEX IF NOT EXISTS idx_cola_dia_fecha ON cola_dia(fecha);
    CREATE INDEX IF NOT EXISTS idx_cola_dia_usuario ON cola_dia_usuario(fecha, usuario_id);
  `);

  // Trigger para updated_at
  await exec(`
    CREATE TRIGGER IF NOT EXISTS trigger_contactos_updated_at
    AFTER UPDATE ON contactos
    BEGIN
      UPDATE contactos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);
}

// Tipos de fila
export interface ContactoRow {
  id: number;
  nombre: string;
  empresa: string | null;
  website: string | null;
  telefono: string | null;
  pais: string;
  tipo_telefono: 'movil' | 'fijo' | 'sin_numero';
  contesto: 0 | 1 | null;
  no_contesto: 0 | 1 | null;
  interesado: 0 | 1 | null;
  rechazado: 0 | 1 | null;
  agendo: 0 | 1 | null;
  cerrado: 0 | 1 | null;
  info_enviada_email: 0 | 1 | null;
  info_enviada_whatsapp: 0 | 1 | null;
  clasificacion: 'Bien' | 'Normal' | 'Mal' | null;
  nota: string | null;
  whatsapp: string | null;
  seguimiento_envio: 0 | 1;
  seguimiento_respuesta: 0 | 1;
  fecha_ultimo_contacto: string | null;
  asignado_a: number | null;
  created_at: string;
  updated_at: string;
}

export interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  nombre: string;
  rol: 'admin' | 'agente';
  created_at: string;
}

export interface EventoRow {
  id: number;
  contacto_id: number;
  tipo: string;
  valor: 0 | 1;
  timestamp: string;
  pais?: string;
  tipo_telefono?: string;
}

export interface ColaDiaRow extends ContactoRow {
  posicion: number;
  bloque_nombre: string;
}

// Helpers CRUD - usando funciones async que devuelven Promises
// Para compatibilidad con código existente, envolvemos en objetos con métodos .run/.get/.all
function makeSync(fn: Function) {
  return {
    run: (...args: any[]) => fn(...args).then((r: any) => ({ lastInsertRowid: r.lastInsertRowid, changes: r.changes })),
    get: (...args: any[]) => fn(...args).then((r: any) => r),
    all: (...args: any[]) => fn(...args).then((r: any) => r),
  };
}

// Contactos repo
export const contactoRepo = {
  findAll: makeSync(() => all('SELECT * FROM contactos ORDER BY pais, tipo_telefono, nombre')),
  findById: makeSync((id: number) => get('SELECT * FROM contactos WHERE id = ?', [id])),
  findByTelefono: makeSync((tel: string) => get('SELECT * FROM contactos WHERE telefono = ? AND telefono IS NOT NULL', [tel])),
  findByPais: makeSync((pais: string) => all('SELECT * FROM contactos WHERE pais = ? ORDER BY tipo_telefono, nombre', [pais])),
  findSinNumero: makeSync(() => all("SELECT * FROM contactos WHERE tipo_telefono = 'sin_numero' ORDER BY pais, nombre")),
  findSinNumeroByAsignado: makeSync((userId: number) => all("SELECT * FROM contactos WHERE tipo_telefono = 'sin_numero' AND asignado_a = ? ORDER BY pais, nombre", [userId])),
  findForQueue: makeSync((pais1: string, pais2: string, tipo: string, limit: number) => all(`
    SELECT * FROM contactos
    WHERE pais IN (?, ?) AND tipo_telefono = ? AND contesto = 0
    ORDER BY
      CASE WHEN no_contesto = 0 AND fecha_ultimo_contacto IS NULL THEN 0 ELSE 1 END,
      fecha_ultimo_contacto ASC
    LIMIT ?
  `, [pais1, pais2, tipo, limit])),
  findForQueueEspana: makeSync((limit: number) => all(`
    SELECT * FROM contactos
    WHERE pais = 'España' AND tipo_telefono IN ('movil', 'fijo') AND contesto = 0
    ORDER BY
      CASE WHEN no_contesto = 0 AND fecha_ultimo_contacto IS NULL THEN 0 ELSE 1 END,
      fecha_ultimo_contacto ASC
    LIMIT ?
  `, [limit])),
  findByFechaUltimoContacto: makeSync((fecha: string) => all(`
    SELECT * FROM contactos
    WHERE fecha_ultimo_contacto = ? AND tipo_telefono != 'sin_numero'
    ORDER BY pais, tipo_telefono, nombre
  `, [fecha])),
  findSeguimiento: makeSync(() => all(`
    SELECT * FROM contactos
    WHERE (interesado = 1 OR agendo = 1)
    ORDER BY seguimiento_respuesta ASC, seguimiento_envio ASC, updated_at DESC
  `)),
  insert: makeSync((...params: any[]) => run(`
    INSERT INTO contactos (nombre, empresa, website, telefono, pais, tipo_telefono,
      contesto, no_contesto, interesado, rechazado, agendo, cerrado,
      info_enviada_email, info_enviada_whatsapp, clasificacion, nota, fecha_ultimo_contacto, asignado_a)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, params)),
  update: makeSync((...params: any[]) => run(`
    UPDATE contactos SET
      nombre = ?, empresa = ?, website = ?, telefono = ?, pais = ?, tipo_telefono = ?,
      contesto = ?, no_contesto = ?, interesado = ?, rechazado = ?, agendo = ?, cerrado = ?,
      info_enviada_email = ?, info_enviada_whatsapp = ?, clasificacion = ?, nota = ?,
      fecha_ultimo_contacto = ?, asignado_a = ?
    WHERE id = ?
  `, params)),
  updateFields: makeSync((...params: any[]) => run(`
    UPDATE contactos SET
      contesto = COALESCE(?, contesto),
      no_contesto = COALESCE(?, no_contesto),
      interesado = COALESCE(?, interesado),
      rechazado = COALESCE(?, rechazado),
      agendo = COALESCE(?, agendo),
      cerrado = COALESCE(?, cerrado),
      info_enviada_email = COALESCE(?, info_enviada_email),
      info_enviada_whatsapp = COALESCE(?, info_enviada_whatsapp),
      clasificacion = COALESCE(?, clasificacion),
      nota = COALESCE(?, nota),
      fecha_ultimo_contacto = COALESCE(?, fecha_ultimo_contacto)
    WHERE id = ?
  `, params)),
  countByPais: makeSync(() => all("SELECT pais, COUNT(*) as total FROM contactos WHERE tipo_telefono != 'sin_numero' GROUP BY pais")),
  countSinNumeroByPais: makeSync(() => all("SELECT pais, COUNT(*) as total FROM contactos WHERE tipo_telefono = 'sin_numero' GROUP BY pais")),
  findByAsignado: makeSync((userId: number) => all('SELECT * FROM contactos WHERE asignado_a = ? ORDER BY pais, tipo_telefono, nombre', [userId])),
  findForQueueByAsignado: makeSync((userId: number, pais1: string, pais2: string, tipo: string, limit: number) => all(`
    SELECT * FROM contactos
    WHERE asignado_a = ? AND pais IN (?, ?) AND tipo_telefono = ? AND contesto = 0
    ORDER BY
      CASE WHEN no_contesto = 0 AND fecha_ultimo_contacto IS NULL THEN 0 ELSE 1 END,
      fecha_ultimo_contacto ASC
    LIMIT ?
  `, [userId, pais1, pais2, tipo, limit])),
  findForQueueEspanaByAsignado: makeSync((userId: number, limit: number) => all(`
    SELECT * FROM contactos
    WHERE asignado_a = ? AND pais = 'España' AND tipo_telefono IN ('movil', 'fijo') AND contesto = 0
    ORDER BY
      CASE WHEN no_contesto = 0 AND fecha_ultimo_contacto IS NULL THEN 0 ELSE 1 END,
      fecha_ultimo_contacto ASC
    LIMIT ?
  `, [userId, limit])),
  findByFechaUltimoContactoByAsignado: makeSync((userId: number, fecha: string) => all(`
    SELECT * FROM contactos
    WHERE asignado_a = ? AND fecha_ultimo_contacto = ? AND tipo_telefono != 'sin_numero'
    ORDER BY pais, tipo_telefono, nombre
  `, [userId, fecha])),
  findSeguimientoByAsignado: makeSync((userId: number) => all(`
    SELECT * FROM contactos
    WHERE asignado_a = ? AND (interesado = 1 OR agendo = 1)
    ORDER BY seguimiento_respuesta ASC, seguimiento_envio ASC, updated_at DESC
  `, [userId])),
  countByPaisByAsignado: makeSync((userId: number) => all('SELECT pais, COUNT(*) as total FROM contactos WHERE asignado_a = ? AND tipo_telefono != \'sin_numero\' GROUP BY pais', [userId])),
  countSinNumeroByPaisByAsignado: makeSync((userId: number) => all('SELECT pais, COUNT(*) as total FROM contactos WHERE asignado_a = ? AND tipo_telefono = \'sin_numero\' GROUP BY pais', [userId])),
};

export const usuarioRepo = {
  findByUsername: makeSync((username: string) => get('SELECT * FROM usuarios WHERE username = ?', [username])),
  findById: makeSync((id: number) => get('SELECT * FROM usuarios WHERE id = ?', [id])),
  findAll: makeSync(() => all('SELECT * FROM usuarios ORDER BY id')),
  insert: makeSync((...params: any[]) => run('INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)', params)),
  update: makeSync((...params: any[]) => run('UPDATE usuarios SET password_hash = ?, nombre = ?, rol = ? WHERE id = ?', params)),
};

export const colaDiaRepo = {
  clearByFecha: makeSync((fecha: string) => run('DELETE FROM cola_dia WHERE fecha = ?', [fecha])),
  insert: makeSync((fecha: string, posicion: number, contacto_id: number, bloque_nombre: string) => run('INSERT INTO cola_dia (fecha, posicion, contacto_id, bloque_nombre) VALUES (?, ?, ?, ?)', [fecha, posicion, contacto_id, bloque_nombre])),
  findByFecha: makeSync((fecha: string) => all(`
    SELECT c.*, cd.posicion, cd.bloque_nombre
    FROM cola_dia cd
    JOIN contactos c ON c.id = cd.contacto_id
    WHERE cd.fecha = ?
    ORDER BY cd.posicion
  `, [fecha])),
};

export const eventoRepo = {
  insert: makeSync((contacto_id: number, tipo: string, valor: number, timestamp: string) => run('INSERT INTO eventos_llamada (contacto_id, tipo, valor, timestamp) VALUES (?, ?, ?, ?)', [contacto_id, tipo, valor, timestamp])),
  findByContacto: makeSync((contacto_id: number) => all('SELECT * FROM eventos_llamada WHERE contacto_id = ? ORDER BY timestamp DESC', [contacto_id])),
  findByTipoAndDateRange: makeSync((tipo1: string, tipo2: string, inicio: string, fin: string) => all(`
    SELECT * FROM eventos_llamada
    WHERE tipo IN (?, ?) AND timestamp >= ? AND timestamp < ?
    ORDER BY timestamp
  `, [tipo1, tipo2, inicio, fin])),
  findAllByDateRange: makeSync((inicio: string, fin: string) => all(`
    SELECT e.*, c.pais, c.tipo_telefono
    FROM eventos_llamada e
    JOIN contactos c ON e.contacto_id = c.id
    WHERE e.timestamp >= ? AND e.timestamp < ?
    ORDER BY e.timestamp
  `, [inicio, fin])),
  countByTipoAndDateRange: makeSync((inicio: string, fin: string) => all(`
    SELECT tipo, COUNT(*) as total
    FROM eventos_llamada
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY tipo
  `, [inicio, fin])),
  countByPaisAndDateRange: makeSync((inicio: string, fin: string) => all(`
    SELECT c.pais, e.tipo, COUNT(*) as total
    FROM eventos_llamada e
    JOIN contactos c ON e.contacto_id = c.id
    WHERE e.timestamp >= ? AND e.timestamp < ?
    GROUP BY c.pais, e.tipo
  `, [inicio, fin])),
  countCallsPerDay: makeSync((inicio: string, fin: string) => all(`
    SELECT date(timestamp) as dia, COUNT(*) as total
    FROM eventos_llamada
    WHERE tipo IN ('contesto', 'no_contesto') AND timestamp >= ? AND timestamp < ?
    GROUP BY date(timestamp)
    ORDER BY dia
  `, [inicio, fin])),
};

// Transacción para actualizar contacto + registrar evento
// libSQL no tiene transacciones síncronas, usamos batch
export const updateContactoWithEvento = async (
  contactoId: number,
  fields: Partial<{
    contesto: number;
    no_contesto: number;
    interesado: number;
    rechazado: number;
    agendo: number;
    cerrado: number;
    info_enviada_email: number;
    info_enviada_whatsapp: number;
    seguimiento_envio: number;
    seguimiento_respuesta: number;
    clasificacion: string | null;
    nota: string | null;
    fecha_ultimo_contacto: string | null;
  }>,
  eventos: Array<{ tipo: string; valor: number }>
) => {
  // Construir query dinámicamente para solo actualizar campos provistos
  const setParts: string[] = [];
  const params: (string | number | null)[] = [];

  if (fields.contesto !== undefined) { setParts.push('contesto = ?'); params.push(fields.contesto); }
  if (fields.no_contesto !== undefined) { setParts.push('no_contesto = ?'); params.push(fields.no_contesto); }
  if (fields.interesado !== undefined) { setParts.push('interesado = ?'); params.push(fields.interesado); }
  if (fields.rechazado !== undefined) { setParts.push('rechazado = ?'); params.push(fields.rechazado); }
  if (fields.agendo !== undefined) { setParts.push('agendo = ?'); params.push(fields.agendo); }
  if (fields.cerrado !== undefined) { setParts.push('cerrado = ?'); params.push(fields.cerrado); }
  if (fields.info_enviada_email !== undefined) { setParts.push('info_enviada_email = ?'); params.push(fields.info_enviada_email); }
  if (fields.info_enviada_whatsapp !== undefined) { setParts.push('info_enviada_whatsapp = ?'); params.push(fields.info_enviada_whatsapp); }
  if (fields.clasificacion !== undefined) { setParts.push('clasificacion = ?'); params.push(fields.clasificacion); }
  if (fields.nota !== undefined) { setParts.push('nota = ?'); params.push(fields.nota); }
  if (fields.seguimiento_envio !== undefined) { setParts.push('seguimiento_envio = ?'); params.push(fields.seguimiento_envio); }
  if (fields.seguimiento_respuesta !== undefined) { setParts.push('seguimiento_respuesta = ?'); params.push(fields.seguimiento_respuesta); }
  if (fields.fecha_ultimo_contacto !== undefined) { setParts.push('fecha_ultimo_contacto = ?'); params.push(fields.fecha_ultimo_contacto); }

  const statements: Array<{ sql: string; args: any[] }> = [];

  if (setParts.length > 0) {
    params.push(contactoId);
    statements.push({ sql: `UPDATE contactos SET ${setParts.join(', ')} WHERE id = ?`, args: params });
  }

  for (const ev of eventos) {
    statements.push({ sql: 'INSERT INTO eventos_llamada (contacto_id, tipo, valor, timestamp) VALUES (?, ?, ?, ?)', args: [contactoId, ev.tipo, ev.valor, nowLocalString()] });
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }
};

// Reemplaza la cola persistida de una fecha (borra + inserta en una transacción).
export const guardarColaDia = async (
  fecha: string,
  filas: Array<{ posicion: number; contacto_id: number; bloque_nombre: string }>
) => {
  const statements = [
    { sql: 'DELETE FROM cola_dia WHERE fecha = ?', args: [fecha] },
  ];
  for (const f of filas) {
    statements.push({ sql: 'INSERT INTO cola_dia (fecha, posicion, contacto_id, bloque_nombre) VALUES (?, ?, ?, ?)', args: [fecha, String(f.posicion), String(f.contacto_id), f.bloque_nombre] });
  }
  await db.batch(statements);
};

// Inicializar migraciones al importar
// runMigrations() ya se ejecutó arriba

// Exportar helpers para uso directo si se necesita
export { db, run, get, all, exec };