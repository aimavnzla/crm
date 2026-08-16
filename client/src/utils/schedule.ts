// Re-export desde la fuente única en server/schedule.ts
export {
  HORARIOS_LLAMADAS,
  TOTAL_DIARIO,
  ZONA_HORARIA,
  PAISES,
  TIPOS_TELEFONO,
  ESTADOS_LLAMADA,
  CLASIFICACIONES,
  getBloqueNombre,
  getPaisesBloque,
  cantidadDelDia,
} from '../../../server/schedule.js';
export type { BloqueHorario, Pais, TipoTelefono, Clasificacion } from '../../../server/schedule.js';

/** Día de la semana actual en Venezuela (0=domingo … 6=sábado), según el huso de Caracas. */
export function getDiaSemanaVenezuela(): number {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short' }).formatToParts(new Date());
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dia = partes.find(p => p.type === 'weekday')?.value ?? '';
  return mapa[dia] ?? -1;
}
