import type {
  Contacto,
  ContactoCola,
  MetricasPeriodo,
  LlamadasPorDia,
  UpdateContactoPayload,
} from './types.js';

// Type for the API client
export type ApiClient = ReturnType<typeof createApi>;

// Rutas relativas con proxy de Vite (desarrollo) o Express static (producción)
function createApi(getAuthHeader: () => string | null) {
  async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const authHeader = getAuthHeader();
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...options?.headers
      },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    // Contactos
    getContactos: (params?: URLSearchParams) =>
      fetchJson<{ data: Contacto[]; total: number; page: number; limit: number; totalPages: number }>(
        `/api/contactos?${params?.toString() || ''}`
      ),

    getSinNumero: () =>
      fetchJson<{ data: Contacto[]; total: number }>(`/api/contactos/sin-numero`),

    getResumenFijos: () =>
      fetchJson<{ total: number; conWhatsapp: number; conMovil: number }>(`/api/contactos/fijos/resumen`),

    getContacto: (id: number) =>
      fetchJson<Contacto>(`/api/contactos/${id}`),

    updateContacto: (id: number, payload: UpdateContactoPayload) =>
      fetchJson<Contacto>(`/api/contactos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    // Cola del día
    getColaHoy: () =>
      fetchJson<ContactoCola[]>(`/api/cola-hoy`),

    // Seguimiento (interesados / agendaron)
    getSeguimiento: () =>
      fetchJson<{ data: Contacto[]; total: number }>(`/api/seguimiento`),

    // Métricas
    getMetricas: (periodo: 'hoy' | 'semana' | 'mes') =>
      fetchJson<MetricasPeriodo>(`/api/metricas?periodo=${periodo}`),

    getSerieLlamadas: () =>
      fetchJson<LlamadasPorDia[]>(`/api/metricas/serie-llamadas?dias=14`),

    // Importar Excel (vía endpoint con FormData)
    importarExcel: (file: File) => {
      const authHeader = getAuthHeader();
      const formData = new FormData();
      formData.append('excel', file);
      return fetch(`/api/importar-excel`, {
        method: 'POST',
        headers: authHeader ? { 'Authorization': authHeader } : {},
        body: formData,
      }).then(res => {
        if (!res.ok) throw new Error('Error importando Excel');
        return res.json();
      });
    },
  };
}

// Exportar factory function
export function createApiClient(getAuthHeader: () => string | null) {
  return createApi(getAuthHeader);
}

// Re-export types for convenience
export type {
  Contacto,
  ContactoCola,
  EventoLlamada,
  MetricasPeriodo,
  LlamadasPorDia,
  FiltrosContactos,
  PaginatedResponse,
  TipoEvento,
  UpdateContactoPayload,
} from './types.js';