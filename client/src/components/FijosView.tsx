import { useState, useEffect, useCallback } from 'react';
import { Phone, MessageCircle, SearchX } from 'lucide-react';
import { Contacto } from '../types';
import { useApi } from '../lib/api-context';
import { ContactsTableSkeleton } from './skeletons/ContactsTableSkeleton';
import { PageHeader, ErrorState, EmptyState } from './ui';

// Móvil encontrado en la web (se guardó en la nota como "Móvil web: +34...")
function extraerMovil(contacto: Contacto): string | null {
  const m = contacto.nota?.match(/Móvil web:\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

function linkWa(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}`;
}

export function FijosView() {
  const api = useApi();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [resumen, setResumen] = useState<{ total: number; conWhatsapp: number; conMovil: number }>({ total: 0, conWhatsapp: 0, conMovil: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [soloConWhatsapp, setSoloConWhatsapp] = useState(false);

  // Resumen del apartado (una sola vez al montar)
  useEffect(() => {
    api.getResumenFijos()
      .then(setResumen)
      .catch(() => { /* no crítico */ });
  }, [api]);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const params = new URLSearchParams({ tipo_telefono: 'fijo', page: String(page), limit: '50' });
      if (busqueda) params.set('busqueda', busqueda);
      if (soloConWhatsapp) params.set('con_whatsapp', '1');
      const data = await api.getContactos(params);
      setContactos(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Error cargando fijos');
    } finally {
      setCargando(false);
    }
  }, [api, page, busqueda, soloConWhatsapp]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resetearFiltros = () => {
    setBusqueda('');
    setSoloConWhatsapp(false);
    setPage(1);
  };

  if (error) {
    return <ErrorState title="Error cargando fijos" message={error} onRetry={cargar} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fijos (España)"
        subtitle="Teléfonos fijos con WhatsApp y números de sus webs"
        actions={
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-aima-text">
              <Phone size={13} strokeWidth={1.7} aria-hidden="true" />
              <b className="tabular-nums">{resumen.total}</b> fijos
            </span>
            <span className="flex items-center gap-1.5 text-aima-success">
              <MessageCircle size={13} strokeWidth={1.7} aria-hidden="true" />
              <b className="tabular-nums">{resumen.conWhatsapp}</b> con WhatsApp
            </span>
            <span className="flex items-center gap-1.5 text-aima-primaryHover">
              <Phone size={13} strokeWidth={1.7} aria-hidden="true" />
              <b className="tabular-nums">{resumen.conMovil}</b> con móvil
            </span>
          </div>
        }
      />

      {/* Filtros */}
      <div className="aima-card border-aima-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 max-w-xs">
            <label htmlFor="busqueda-fijos" className="sr-only">Buscar fijo</label>
            <input
              id="busqueda-fijos"
              type="text"
              className="input"
              placeholder="Buscar por nombre o empresa..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-aima-textMuted cursor-pointer select-none">
            <input
              type="checkbox"
              className="checkbox"
              checked={soloConWhatsapp}
              onChange={(e) => { setSoloConWhatsapp(e.target.checked); setPage(1); }}
            />
            Solo con WhatsApp
          </label>
          {(busqueda || soloConWhatsapp) && (
            <button onClick={resetearFiltros} className="btn-ghost text-xs py-1 px-2">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="aima-card border-aima-border rounded-xl overflow-hidden">
        {cargando ? (
          <ContactsTableSkeleton />
        ) : contactos.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No se encontraron fijos"
            description="Ajusta la búsqueda o los filtros."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" role="grid">
                <thead>
                  <tr className="bg-aima-bg border-b border-aima-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Teléfono fijo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">WhatsApp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Móvil (web)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aima-border">
                  {contactos.map((contacto) => {
                    const movil = extraerMovil(contacto);
                    return (
                      <tr key={contacto.id} className="hover:bg-aima-bg/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-aima-text truncate max-w-xs">{contacto.nombre}</div>
                          {contacto.website && (
                            <a
                              href={contacto.website.startsWith('http') ? contacto.website : `https://${contacto.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-aima-primaryHover hover:underline truncate block max-w-xs mt-0.5"
                            >
                              {contacto.website}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {contacto.empresa ? (
                            <span className="text-aima-textMuted truncate block max-w-xs">{contacto.empresa}</span>
                          ) : (
                            <span className="text-aima-textMuted/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-aima-text whitespace-nowrap">
                          {contacto.telefono || <span className="text-aima-textMuted">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {contacto.whatsapp ? (
                            <a
                              href={linkWa(contacto.whatsapp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-sm text-aima-success hover:underline whitespace-nowrap"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={14} strokeWidth={1.7} aria-hidden="true" />
                              {contacto.whatsapp}
                            </a>
                          ) : (
                            <span className="text-aima-textMuted/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {movil ? (
                            <a
                              href={linkWa(movil)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-sm text-aima-text hover:text-aima-primaryHover whitespace-nowrap"
                              title="Abrir WhatsApp (número de la web)"
                            >
                              <MessageCircle size={14} strokeWidth={1.7} aria-hidden="true" />
                              {movil}
                            </a>
                          ) : (
                            <span className="text-aima-textMuted/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-aima-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-aima-textMuted">
                  Página {page} de {totalPages} · {total} fijos
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-secondary text-sm px-3 py-1"
                    aria-label="Página anterior"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                    className="btn-secondary text-sm px-3 py-1"
                    aria-label="Página siguiente"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
