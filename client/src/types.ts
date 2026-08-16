export interface Contacto {
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
  /** 0 = pendiente de enviar info, 1 = info enviada (seguimiento). */
  seguimiento_envio: 0 | 1;
  /** 0 = no respondió, 1 = respondió (seguimiento). */
  seguimiento_respuesta: 0 | 1;
  fecha_ultimo_contacto: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactoCola extends Contacto {
  bloque: {
    inicio: string;
    fin: string;
    paises: string[];
    tipo: 'movil' | 'fijo' | 'movil+fijo';
    cantidad: number;
    nombre: string;
  };
  posicion: number;
}

export interface EventoLlamada {
  id: number;
  contacto_id: number;
  tipo: 'contesto' | 'no_contesto' | 'interesado' | 'rechazado' | 'agendo' | 'cerrado' | 'email' | 'whatsapp';
  valor: 0 | 1;
  timestamp: string;
}

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

export interface FiltrosContactos {
  pais?: string;
  tipo_telefono?: 'movil' | 'fijo' | 'sin_numero' | 'todos';
  estado?: 'contesto' | 'no_contesto' | 'interesado' | 'sin_contactar' | 'todos';
  busqueda?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type TipoEvento = 'contesto' | 'no_contesto' | 'interesado' | 'rechazado' | 'agendo' | 'cerrado' | 'email' | 'whatsapp';

export interface UpdateContactoPayload {
  contesto?: 0 | 1;
  no_contesto?: 0 | 1;
  interesado?: 0 | 1;
  rechazado?: 0 | 1;
  agendo?: 0 | 1;
  cerrado?: 0 | 1;
  info_enviada_email?: 0 | 1;
  info_enviada_whatsapp?: 0 | 1;
  seguimiento_envio?: 0 | 1;
  seguimiento_respuesta?: 0 | 1;
  clasificacion?: 'Bien' | 'Normal' | 'Mal' | null;
  nota?: string | null;
  fecha_ultimo_contacto?: string | null;
}