import { HORARIOS_LLAMADAS, TOTAL_DIARIO, cantidadDelDia } from './schedule.js';
import { contactoRepo, colaDiaRepo, guardarColaDia, db } from './db.js';
import type { ColaDiaRow, ContactoRow } from './db.js';
import { obtenerFechaLocal } from './date.js';
import { usuarioRepo } from './db.js';

export interface BloqueHorario {
  inicio: string;
  fin: string;
  paises: string[];
  tipo: 'movil' | 'fijo' | 'movil+fijo';
  cantidad: number;
  cantidadLunes?: number;
  cantidadViernes?: number;
  nombre: string;
  periodo: 'mañana' | 'tarde';
  dias: number[];
}

export interface ContactoCola {
  id: number;
  nombre: string;
  empresa: string | null;
  website: string | null;
  telefono: string | null;
  pais: string;
  tipo_telefono: string;
  bloque: BloqueHorario;
  posicion: number;
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function isInTimeBlock(now: Date, bloque: BloqueHorario): boolean {
  const { hours: nowH, minutes: nowM } = { hours: now.getHours(), minutes: now.getMinutes() };
  const { hours: startH, minutes: startM } = parseTime(bloque.inicio);
  const { hours: endH, minutes: endM } = parseTime(bloque.fin);

  const nowMinutes = nowH * 60 + nowM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

async function getContactosParaBloque(bloque: BloqueHorario, usados: Set<number>, userId?: number): Promise<any[]> {
  let contactos: any[] = [];

  if (bloque.tipo === 'movil+fijo') {
    // España: móviles + fijos juntos - usar query global (sin filtro asignado_a)
    contactos = await contactoRepo.findForQueueEspana.all(bloque.cantidad * 5);
  } else {
    // Otros países: solo móviles - query global
    for (const pais of bloque.paises) {
      const c = await contactoRepo.findForQueue.all(pais, pais, 'movil', bloque.cantidad * 5);
      contactos.push(...c);
    }
  }

  // Filtrar los ya usados en otros bloques hoy
  contactos = contactos.filter(c => !usados.has(c.id));

  // Ordenar por prioridad: nunca contactados primero, luego reintentos por fecha antigua
  contactos.sort((a, b) => {
    const aNunca = a.no_contesto === 0 && a.fecha_ultimo_contacto === null;
    const bNunca = b.no_contesto === 0 && b.fecha_ultimo_contacto === null;
    if (aNunca && !bNunca) return -1;
    if (!aNunca && bNunca) return 1;
    // Ambos misma prioridad: por fecha más antigua
    if (a.fecha_ultimo_contacto && b.fecha_ultimo_contacto) {
      return new Date(a.fecha_ultimo_contacto).getTime() - new Date(b.fecha_ultimo_contacto).getTime();
    }
    if (a.fecha_ultimo_contacto) return 1;
    if (b.fecha_ultimo_contacto) return -1;
    return 0;
  });

  // Si hay userId, mezclar de forma determinística por usuario para que cada uno tenga contactos distintos
  // Usamos un hash simple del userId para crear un offset único
  if (userId && contactos.length > 0) {
    const offset = (userId * 17 + 7) % contactos.length; // offset determinístico por usuario
    // Rotar el array para que cada usuario empiece en posición distinta
    contactos = [...contactos.slice(offset), ...contactos.slice(0, offset)];
  }

  return contactos.slice(0, bloque.cantidad);
}

function bloquesDelDia(fecha: Date): BloqueHorario[] {
  // Regla de negocio por día de la semana (0=domingo … 6=sábado):
  // - Fin de semana: sin llamadas.
  // - Lunes: solo la ronda de tarde. Viernes: solo la ronda de mañana.
  const diaSemana = fecha.getDay();
  return HORARIOS_LLAMADAS.filter(b => b.dias.includes(diaSemana));
}

// ¿El contacto encaja en el bloque (país y tipo de teléfono)?
function encajaEnBloque(contacto: any, bloque: BloqueHorario): boolean {
  if (!bloque.paises.includes(contacto.pais)) return false;
  if (bloque.tipo === 'movil+fijo') return contacto.tipo_telefono === 'movil' || contacto.tipo_telefono === 'fijo';
  return contacto.tipo_telefono === bloque.tipo;
}

export async function generarColaDelDia(fecha: Date = new Date(), userId?: number): Promise<ContactoCola[]> {
  const diaSemana = fecha.getDay();
  const usados = new Set<number>();
  const cola: ContactoCola[] = [];
  let posicionGlobal = 1;

  // Contactos ya trabajados HOY (fecha_ultimo_contacto = hoy): deben quedarse en la
  // cola del día. Sin esto, cada regeneración los descarta (los que contestaron salen
  // del pool por `contesto = 0` y los que no contestaron pierden prioridad frente a
  // los nunca contactados) y la cola se re-mezcla en cada recarga.
  const trabajadosHoy = new Map<number, any>();
  if (diaSemana >= 1 && diaSemana <= 5) {
    // Usar query global (sin filtro asignado_a) - la cola es de BD compartida
    const rows = await contactoRepo.findByFechaUltimoContacto.all(obtenerFechaLocal());
    for (const c of rows) {
      trabajadosHoy.set(c.id, c);
    }
  }

  for (const bloque of bloquesDelDia(fecha)) {
    // Cantidad según el día (lunes/viernes tienen una ronda completa de 80)
    const bloqueResuelto = { ...bloque, cantidad: cantidadDelDia(bloque, diaSemana) };
    const asignados: any[] = [];

    // 1) Los ya trabajados hoy encajan primero en su bloque (mañana antes que tarde)
    for (const c of trabajadosHoy.values()) {
      if (!usados.has(c.id) && encajaEnBloque(c, bloque) && asignados.length < bloqueResuelto.cantidad) {
        asignados.push(c);
        usados.add(c.id);
      }
    }

    // 2) Completar el bloque con la selección normal (nunca contactados primero)
    const restantes = bloqueResuelto.cantidad - asignados.length;
    if (restantes > 0) {
      const nuevos = await getContactosParaBloque({ ...bloqueResuelto, cantidad: restantes }, usados, userId);
      asignados.push(...nuevos);
    }

    for (const c of asignados) {
      usados.add(c.id);
      cola.push({
        id: c.id,
        nombre: c.nombre,
        empresa: c.empresa,
        website: c.website,
        telefono: c.telefono,
        pais: c.pais,
        tipo_telefono: c.tipo_telefono,
        bloque: bloqueResuelto,
        posicion: posicionGlobal++
      });
    }
  }

  return cola;
}

/**
 * Cola de llamadas del día para un usuario específico. Se genera UNA vez y se persiste en `cola_dia`.
 * Mientras no cambie la fecha en Venezuela devuelve siempre la misma lista
 * (con el estado vivo de cada contacto vía JOIN); al cambiar el día, se
 * regenera y reemplaza la persistida. Fines de semana: cola vacía.
 */
export async function obtenerColaDelDia(fecha: Date = new Date(), userId?: number): Promise<ContactoCola[]> {
  const fechaStr = obtenerFechaLocal();

  if (userId) {
    // Cola por usuario: buscar en cola_dia_usuario
    const filas = (await db.execute({
      sql: `
        SELECT c.*, cd.posicion, cd.bloque_nombre
        FROM cola_dia_usuario cd
        JOIN contactos c ON c.id = cd.contacto_id
        WHERE cd.fecha = ? AND cd.usuario_id = ?
        ORDER BY cd.posicion
      `,
      args: [fechaStr, userId]
    })).rows as ColaDiaRow[];

    if (filas.length > 0) {
      return filas.map(fila => {
        const bloque = HORARIOS_LLAMADAS.find(b => b.nombre === fila.bloque_nombre) ?? HORARIOS_LLAMADAS[0];
        return {
          id: fila.id,
          nombre: fila.nombre,
          empresa: fila.empresa,
          website: fila.website,
          telefono: fila.telefono,
          pais: fila.pais,
          tipo_telefono: fila.tipo_telefono,
          contesto: fila.contesto,
          no_contesto: fila.no_contesto,
          interesado: fila.interesado,
          rechazado: fila.rechazado,
          agendo: fila.agendo,
          cerrado: fila.cerrado,
          info_enviada_email: fila.info_enviada_email,
          info_enviada_whatsapp: fila.info_enviada_whatsapp,
          clasificacion: fila.clasificacion,
          nota: fila.nota,
          whatsapp: fila.whatsapp,
          fecha_ultimo_contacto: fila.fecha_ultimo_contacto,
          bloque,
          posicion: fila.posicion,
        };
      });
    }

    // No hay cola persistida para hoy: generarla y guardarla (una sola vez al día por usuario)
    const cola = await generarColaDelDia(fecha, userId);
    if (cola.length > 0) {
      const statements = [
        { sql: 'DELETE FROM cola_dia_usuario WHERE fecha = ? AND usuario_id = ?', args: [fechaStr, userId] },
      ];
      for (const c of cola) {
        statements.push({ sql: 'INSERT INTO cola_dia_usuario (fecha, usuario_id, posicion, contacto_id, bloque_nombre) VALUES (?, ?, ?, ?, ?)', args: [fechaStr, userId, c.posicion, c.id, c.bloque.nombre] });
      }
      await db.batch(statements);
    }
    return cola;
  }

  // Fallback: cola global (para compatibilidad o admin)
  const filas = (await colaDiaRepo.findByFecha.all(fechaStr)) as ColaDiaRow[];

  if (filas.length > 0) {
    return filas.map(fila => {
      const bloque = HORARIOS_LLAMADAS.find(b => b.nombre === fila.bloque_nombre) ?? HORARIOS_LLAMADAS[0];
      return {
        id: fila.id,
        nombre: fila.nombre,
        empresa: fila.empresa,
        website: fila.website,
        telefono: fila.telefono,
        pais: fila.pais,
        tipo_telefono: fila.tipo_telefono,
        contesto: fila.contesto,
        no_contesto: fila.no_contesto,
        interesado: fila.interesado,
        rechazado: fila.rechazado,
        agendo: fila.agendo,
        cerrado: fila.cerrado,
        info_enviada_email: fila.info_enviada_email,
        info_enviada_whatsapp: fila.info_enviada_whatsapp,
        clasificacion: fila.clasificacion,
        nota: fila.nota,
        whatsapp: fila.whatsapp,
        fecha_ultimo_contacto: fila.fecha_ultimo_contacto,
        bloque,
        posicion: fila.posicion,
      };
    });
  }

  // No hay cola persistida para hoy: generarla y guardarla (una sola vez al día)
  const cola = await generarColaDelDia(fecha);
  if (cola.length > 0) {
    await guardarColaDia(
      fechaStr,
      cola.map(c => ({ posicion: c.posicion, contacto_id: c.id, bloque_nombre: c.bloque.nombre }))
    );
  }
  return cola;
}

export function obtenerBloqueActual(fecha: Date = new Date()): BloqueHorario | null {
  for (const bloque of bloquesDelDia(fecha)) {
    if (isInTimeBlock(fecha, bloque)) {
      return bloque;
    }
  }
  return null;
}

export function obtenerProximoBloque(fecha: Date = new Date()): BloqueHorario | null {
  const { hours: nowH, minutes: nowM } = { hours: fecha.getHours(), minutes: fecha.getMinutes() };
  const nowMinutes = nowH * 60 + nowM;

  for (const bloque of bloquesDelDia(fecha)) {
    const { hours: startH, minutes: startM } = parseTime(bloque.inicio);
    const startMinutes = startH * 60 + startM;
    if (nowMinutes < startMinutes) {
      return bloque;
    }
  }
  return null; // Ya pasó el último bloque
}

export function formatearHoraVenezuela(fecha: Date): string {
  return fecha.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Caracas'
  });
}

export function obtenerFechaVenezuela(): Date {
  // Forzar zona horaria Venezuela
  const ahora = new Date();
  const venezuelaOffset = -4 * 60; // UTC-4
  const localOffset = ahora.getTimezoneOffset();
  const diff = (venezuelaOffset - localOffset) * 60 * 1000;
  return new Date(ahora.getTime() + diff);
}