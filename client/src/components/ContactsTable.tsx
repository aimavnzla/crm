import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, Lightbulb, Clock, SearchX } from 'lucide-react';
import { Contacto, FiltrosContactos } from '../types';
import { useApi } from '../lib/api-context';
import { ContactsTableSkeleton } from './skeletons/ContactsTableSkeleton';
import { PAISES } from '../utils/schedule';
import { PageHeader, ErrorState, EmptyState } from './ui';

type EstadoFiltro = 'todos' | 'contesto' | 'no_contesto' | 'interesado' | 'sin_contactar';

export function ContactsTable() {
  const api = useApi();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [filtros, setFiltros] = useState<FiltrosContactos>({
    pais: 'todos',
    tipo_telefono: 'todos',
    estado: 'todos',
    busqueda: '',
    page: 1,
    limit: 50,
  });
  // La búsqueda se escribe libremente en este estado y se aplica con debounce,
  // para que no se dispare un fetch por cada tecla.
  const [busqueda, setBusqueda] = useState('');
  // Guard para descartar respuestas de peticiones viejas al escribir rápido.
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltros(prev => (prev.busqueda === busqueda ? prev : { ...prev, busqueda, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const cargarContactos = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      setCargando(true);
      setError(null);
      const params = new URLSearchParams();
      if (filtros.pais && filtros.pais !== 'todos') params.append('pais', filtros.pais);
      if (filtros.tipo_telefono && filtros.tipo_telefono !== 'todos') params.append('tipo_telefono', filtros.tipo_telefono);
      if (filtros.estado && filtros.estado !== 'todos') params.append('estado', filtros.estado);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      params.append('page', String(filtros.page || 1));
      params.append('limit', String(filtros.limit || 50));

      const data = await api.getContactos(params);
      if (seq !== requestSeq.current) return; // respuesta vieja, descartar
      setContactos(data.data);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      setError(err.message || 'Error cargando contactos');
    } finally {
      if (seq === requestSeq.current) setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargarContactos();
  }, [cargarContactos]);

  const handleFiltroChange = (campo: keyof FiltrosContactos, valor: any) => {
    setFiltros(prev => ({ ...prev, [campo]: valor, page: 1 }));
  };

  const handlePageChange = (nuevaPage: number) => {
    setFiltros(prev => ({ ...prev, page: nuevaPage }));
  };

  const getEstadoBadge = (contacto: Contacto) => {
    if (contacto.contesto === 1) {
      return (
        <span className="badge badge-success">
          <Check size={11} strokeWidth={2.2} className="mr-1" aria-hidden="true" />
          Contestó
        </span>
      );
    }
    if (contacto.no_contesto === 1) {
      return (
        <span className="badge badge-danger">
          <X size={11} strokeWidth={2.2} className="mr-1" aria-hidden="true" />
          No contestó
        </span>
      );
    }
    if (contacto.interesado === 1) {
      return (
        <span className="badge badge-warning">
          <Lightbulb size={11} strokeWidth={2} className="mr-1" aria-hidden="true" />
          Interesado
        </span>
      );
    }
    return (
      <span className="badge badge-gray">
        <Clock size={11} strokeWidth={2} className="mr-1" aria-hidden="true" />
        Sin contactar
      </span>
    );
  };

  const getClasificacionBadge = (clasificacion: Contacto['clasificacion']) => {
    if (!clasificacion) return <span className="badge badge-gray">—</span>;
    switch (clasificacion) {
      case 'Bien': return <span className="badge badge-success">Bien</span>;
      case 'Normal': return <span className="badge badge-info">Normal</span>;
      case 'Mal': return <span className="badge badge-danger">Mal</span>;
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contactos"
        subtitle={`${total} contactos totales`}
      />

      {/* Filtros */}
      <div className="aima-card border-aima-border rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="busqueda" className="sr-only">Buscar por nombre, empresa o teléfono</label>
            <input
              id="busqueda"
              type="text"
              className="input"
              placeholder="Buscar por nombre, empresa o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="pais" className="sr-only">Filtrar por país</label>
            <select
              id="pais"
              className="select"
              value={filtros.pais || 'todos'}
              onChange={(e) => handleFiltroChange('pais', e.target.value)}
            >
              <option value="todos">Todos los países</option>
              {PAISES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tipo" className="sr-only">Filtrar por tipo de teléfono</label>
            <select
              id="tipo"
              className="select"
              value={filtros.tipo_telefono || 'todos'}
              onChange={(e) => handleFiltroChange('tipo_telefono', e.target.value as 'movil' | 'fijo' | 'sin_numero' | 'todos')}
            >
              <option value="todos">Todos los tipos</option>
              <option value="movil">Móvil</option>
              <option value="fijo">Fijo (España)</option>
              <option value="sin_numero">Sin número</option>
            </select>
          </div>

          <div>
            <label htmlFor="estado" className="sr-only">Filtrar por estado</label>
            <select
              id="estado"
              className="select"
              value={filtros.estado || 'todos'}
              onChange={(e) => handleFiltroChange('estado', e.target.value as EstadoFiltro)}
            >
              <option value="todos">Todos los estados</option>
              <option value="contesto">Contestó</option>
              <option value="no_contesto">No contestó</option>
              <option value="interesado">Interesado</option>
              <option value="sin_contactar">Sin contactar</option>
            </select>
          </div>
        </div>
      </div>

      {cargando ? (
        <ContactsTableSkeleton />
      ) : error ? (
        <ErrorState title="Error cargando contactos" message={error} onRetry={cargarContactos} />
      ) : (
        /* Tabla de contactos */
        <div className="aima-card border-aima-border rounded-xl overflow-hidden">
        {contactos.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No se encontraron contactos"
            description="Intente ajustar los filtros o importe contactos."
          />
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full" role="grid">
                <thead>
                  <tr className="bg-aima-bg border-b border-aima-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">País / Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Clasif.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Últ. Contacto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aima-border">
                  {contactos.map((contacto) => (
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`badge ${contacto.pais === 'España' && contacto.tipo_telefono === 'fijo' ? 'badge-purple' : 'badge-gray'}`}>
                            {contacto.pais}
                          </span>
                          {contacto.tipo_telefono === 'fijo' && (
                            <span className="badge badge-purple text-xs">Fijo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-aima-text tabular-nums">
                        {contacto.telefono || <span className="text-aima-textMuted">Sin número</span>}
                      </td>
                      <td className="px-4 py-3">{getEstadoBadge(contacto)}</td>
                      <td className="px-4 py-3">{getClasificacionBadge(contacto.clasificacion)}</td>
                      <td className="px-4 py-3 text-sm text-aima-textMuted tabular-nums">
                        {contacto.fecha_ultimo_contacto ? new Date(contacto.fecha_ultimo_contacto).toLocaleDateString('es-VE') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="btn-ghost text-xs py-1 px-2"
                          onClick={() => window.open(`/contactos/${contacto.id}`, '_blank')}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-aima-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-aima-textMuted tabular-nums">
                  Página {page} de {totalPages} · {total} contactos
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="btn-secondary text-sm px-3 py-1"
                    aria-label="Página anterior"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
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
      )}
    </div>
  );
}
