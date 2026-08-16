// Configuración de horarios de llamadas (fuente única compartida con el cliente).
// El cliente re-exporta desde aquí (client/src/utils/schedule.ts) para evitar drift.

export interface BloqueHorario {
  inicio: string;
  fin: string;
  paises: string[];
  tipo: 'movil' | 'fijo' | 'movil+fijo';
  /** Cantidad estándar (mar–jue, horario completo). */
  cantidad: number;
  /** Cantidad del lunes (ese día corre solo la ronda de tarde). */
  cantidadLunes?: number;
  /** Cantidad del viernes (ese día corre solo la ronda de mañana). */
  cantidadViernes?: number;
  nombre: string;
  /** Ronda del día a la que pertenece el bloque. */
  periodo: 'mañana' | 'tarde';
  /**
   * Días de la semana en que corre el bloque (0 = domingo … 6 = sábado).
   * Regla de negocio: cada día suma 80 llamadas; lunes solo ronda de tarde,
   * viernes solo ronda de mañana, fin de semana sin llamadas.
   */
  dias: number[];
}

export const HORARIOS_LLAMADAS: BloqueHorario[] = [
  // Ronda de mañana · mar–vie (el viernes es día completo de 80 en una sola ronda)
  { inicio: "03:00", fin: "05:00", paises: ["España"], tipo: "movil+fijo", cantidad: 18, cantidadViernes: 28, nombre: "España mañana", periodo: 'mañana', dias: [2, 3, 4, 5] },
  { inicio: "08:00", fin: "10:00", paises: ["Argentina", "Uruguay"], tipo: "movil", cantidad: 18, cantidadViernes: 28, nombre: "Arg/Ury mañana", periodo: 'mañana', dias: [2, 3, 4, 5] },
  { inicio: "10:00", fin: "10:30", paises: ["Colombia", "Panama"], tipo: "movil", cantidad: 4, cantidadViernes: 6, nombre: "Col/Pan apertura", periodo: 'mañana', dias: [2, 3, 4, 5] },
  { inicio: "11:30", fin: "12:00", paises: ["Colombia", "Panama"], tipo: "movil", cantidad: 4, cantidadViernes: 6, nombre: "Col/Pan cierre", periodo: 'mañana', dias: [2, 3, 4, 5] },
  { inicio: "12:00", fin: "13:00", paises: ["Costa Rica", "Mexico"], tipo: "movil", cantidad: 8, cantidadViernes: 12, nombre: "CR/Mex mañana", periodo: 'mañana', dias: [2, 3, 4, 5] },

  // Ronda de tarde · lun–jue (el lunes es día completo de 80 en una sola ronda)
  { inicio: "10:30", fin: "11:30", paises: ["España"], tipo: "movil+fijo", cantidad: 8, cantidadLunes: 23, nombre: "España tarde", periodo: 'tarde', dias: [1, 2, 3, 4] },
  { inicio: "16:00", fin: "16:30", paises: ["Argentina", "Uruguay"], tipo: "movil", cantidad: 4, cantidadLunes: 11, nombre: "Arg/Ury tarde", periodo: 'tarde', dias: [1, 2, 3, 4] },
  { inicio: "17:30", fin: "18:30", paises: ["Colombia", "Panama"], tipo: "movil", cantidad: 8, cantidadLunes: 23, nombre: "Col/Pan tarde", periodo: 'tarde', dias: [1, 2, 3, 4] },
  { inicio: "18:30", fin: "19:30", paises: ["Costa Rica", "Mexico"], tipo: "movil", cantidad: 8, cantidadLunes: 23, nombre: "CR/Mex tarde", periodo: 'tarde', dias: [1, 2, 3, 4] },
];

/** Resuelve la cantidad de un bloque según el día de la semana (0=domingo … 6=sábado). */
export function cantidadDelDia(bloque: BloqueHorario, diaSemana: number): number {
  if (diaSemana === 1 && bloque.cantidadLunes !== undefined) return bloque.cantidadLunes;
  if (diaSemana === 5 && bloque.cantidadViernes !== undefined) return bloque.cantidadViernes;
  return bloque.cantidad;
}

export const TOTAL_DIARIO = 80;
export const ZONA_HORARIA = "America/Caracas";

export const PAISES = [
  'Argentina', 'Colombia', 'Costa Rica', 'España', 'Mexico', 'Panama', 'Uruguay'
] as const;

export type Pais = typeof PAISES[number];

export const TIPOS_TELEFONO = ['movil', 'fijo', 'sin_numero'] as const;
export type TipoTelefono = typeof TIPOS_TELEFONO[number];

export const ESTADOS_LLAMADA = [
  'contesto', 'no_contesto', 'interesado', 'rechazado', 'agendo', 'cerrado', 'email', 'whatsapp'
] as const;

export const CLASIFICACIONES = ['Bien', 'Normal', 'Mal'] as const;
export type Clasificacion = typeof CLASIFICACIONES[number];

export function getBloqueNombre(bloque: BloqueHorario): string {
  return `${bloque.nombre} (${bloque.inicio}–${bloque.fin})`;
}

export function getPaisesBloque(bloque: BloqueHorario): string {
  return bloque.paises.join(' + ');
}
