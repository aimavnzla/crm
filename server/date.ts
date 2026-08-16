// Helpers de fecha en zona horaria Venezuela (fuente única compartida con el cliente).
// El cliente re-exporta desde aquí (client/src/utils/date.ts) para evitar drift.

import { ZONA_HORARIA } from './schedule.js';

export function obtenerFechaVenezuela(): Date {
  const ahora = new Date();
  // Usar Intl para obtener la fecha en zona horaria Venezuela
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(ahora);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return new Date(`${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`);
}

export function obtenerFechaLocal(): string {
  const fecha = obtenerFechaVenezuela();
  return fecha.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Formatea una fecha como 'YYYY-MM-DD HH:mm:ss' en hora local (Venezuela).
// SQLite guarda timestamps como strings; usar esto garantiza consistencia con
// los rangos que usa metrics.ts (obtenerFechaVenezuela ya representa la hora de Caracas).
export function toDateTimeString(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  const hours = String(fecha.getHours()).padStart(2, '0');
  const minutes = String(fecha.getMinutes()).padStart(2, '0');
  const seconds = String(fecha.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Timestamp actual en hora Venezuela, listo para guardar en SQLite.
export function nowLocalString(): string {
  return toDateTimeString(obtenerFechaVenezuela());
}

export function obtenerInicioSemana(fecha: Date = obtenerFechaVenezuela()): Date {
  const dia = fecha.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia; // Lunes = inicio de semana
  const inicio = new Date(fecha);
  inicio.setDate(fecha.getDate() + diff);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export function obtenerFinSemana(fecha: Date = obtenerFechaVenezuela()): Date {
  const inicio = obtenerInicioSemana(fecha);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

export function obtenerInicioMes(fecha: Date = obtenerFechaVenezuela()): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

export function obtenerFinMes(fecha: Date = obtenerFechaVenezuela()): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatearFecha(fecha: Date | string): string {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return f.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONA_HORARIA
  });
}

export function formatearFechaHora(fecha: Date | string): string {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return f.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA_HORARIA
  });
}

export function esHoy(fecha: Date | string): boolean {
  const hoy = obtenerFechaLocal();
  const f = typeof fecha === 'string' ? fecha.split('T')[0] : fecha.toISOString().split('T')[0];
  return f === hoy;
}

export function diasDiferencia(fecha1: Date, fecha2: Date): number {
  const diff = fecha1.getTime() - fecha2.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
