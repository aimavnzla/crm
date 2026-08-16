import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Clock, CalendarOff, Search, SearchX } from 'lucide-react';
import { ContactoCola } from '../types';
import { useApi } from '../lib/api-context';
import { CallCard } from './CallCard';
import { CallQueueSkeleton } from './skeletons/CallQueueSkeleton';
import { HORARIOS_LLAMADAS, PAISES, cantidadDelDia, getDiaSemanaVenezuela } from '../utils/schedule';
import { PageHeader, ErrorState, EmptyState } from './ui';
import { useEntrance } from '../lib/motion';

export function CallQueue() {
  const api = useApi();
  const [cola, setCola] = useState<ContactoCola[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const diaSemana = getDiaSemanaVenezuela();
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

  // Filtros de la cola (client-side: la cola son ~80 contactos)
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroPais, setFiltroPais] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'contesto' | 'no_contesto'>('todos');

  const hayFiltros = filtroTexto.trim() !== '' || filtroPais !== 'todos' || filtroTipo !== 'todos' || filtroEstado !== 'todos';

  const colaFiltrada = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return cola.filter(c => {
      if (filtroPais !== 'todos' && c.pais !== filtroPais) return false;
      if (filtroTipo !== 'todos' && c.tipo_telefono !== filtroTipo) return false;
      if (filtroEstado === 'contesto' && c.contesto !== 1) return false;
      if (filtroEstado === 'no_contesto' && c.no_contesto !== 1) return false;
      if (filtroEstado === 'pendiente' && (c.contesto === 1 || c.no_contesto === 1)) return false;
      if (q) {
        return `${c.nombre} ${c.empresa || ''} ${c.telefono || ''}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cola, filtroTexto, filtroPais, filtroTipo, filtroEstado]);

  const cargarCola = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const data = await api.getColaHoy();
      setCola(data);
      setUltimaActualizacion(new Date());
    } catch (err: any) {
      setError(err.message || 'Error cargando la cola');
    } finally {
      setCargando(false);
    }
  }, [api]);

  useEffect(() => {
    cargarCola();
    // Recargar cada 5 minutos
    const interval = setInterval(cargarCola, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cargarCola]);

  const handleActualizarContacto = useCallback((contactoActualizado: ContactoCola) => {
    setCola(prev => prev.map(c => c.id === contactoActualizado.id ? contactoActualizado : c));
  }, []);

  // Agrupar por bloque (usar nombre, único: varios bloques comparten cantidad)
  const colaPorBloque = new Map<string, ContactoCola[]>();
  colaFiltrada.forEach(c => {
    if (!colaPorBloque.has(c.bloque.nombre)) {
      colaPorBloque.set(c.bloque.nombre, []);
    }
    colaPorBloque.get(c.bloque.nombre)!.push(c);
  });

  // Ordenar bloques según HORARIOS_LLAMADAS
  const bloquesOrdenados = HORARIOS_LLAMADAS.filter(b => colaPorBloque.has(b.nombre));

  const bloquesRef = useEntrance<HTMLDivElement>([bloquesOrdenados.length > 0], { y: 8, stagger: 0.06 });

  if (cargando) {
    return <CallQueueSkeleton />;
  }

  if (error) {
    return <ErrorState title="Error cargando la cola" message={error} onRetry={cargarCola} />;
  }

  const totalLlamadas = colaFiltrada.length;
  const contestadas = colaFiltrada.filter(c => c.contesto === 1).length;
  const noContestadas = colaFiltrada.filter(c => c.no_contesto === 1).length;
  const pendientes = totalLlamadas - contestadas - noContestadas;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cola de Hoy"
        subtitle={hayFiltros
          ? `${totalLlamadas} de ${cola.length} llamadas · ${bloquesOrdenados.length} bloques`
          : `${totalLlamadas} llamadas · ${bloquesOrdenados.length} bloques`}
        actions={
          <>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-aima-success">
                <span className="w-2 h-2 rounded-full bg-aima-success" aria-hidden="true" />
                Contestaron: <b className="tabular-nums">{contestadas}</b>
              </span>
              <span className="flex items-center gap-1.5 text-aima-danger">
                <span className="w-2 h-2 rounded-full bg-aima-danger" aria-hidden="true" />
                No contestaron: <b className="tabular-nums">{noContestadas}</b>
              </span>
              <span className="flex items-center gap-1.5 text-aima-textMuted">
                <span className="w-2 h-2 rounded-full bg-aima-textMuted" aria-hidden="true" />
                Pendientes: <b className="tabular-nums">{pendientes}</b>
              </span>
            </div>

            <button onClick={cargarCola} className="btn-secondary text-sm" disabled={cargando}>
              <RefreshCw size={14} strokeWidth={2} className={`mr-2 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
              Actualizar
            </button>

            {ultimaActualizacion && (
              <span className="hidden lg:inline-flex items-center gap-1 text-xs text-aima-textMuted">
                <Clock size={12} strokeWidth={1.7} aria-hidden="true" />
                {ultimaActualizacion.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas' })}
              </span>
            )}
          </>
        }
      />

      {/* Filtros de la cola */}
      <div className="aima-card border-aima-border rounded-xl p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="filtro-busqueda" className="sr-only">Buscar en la cola</label>
            <div className="relative">
              <Search size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-aima-textMuted" aria-hidden="true" />
              <input
                id="filtro-busqueda"
                type="text"
                className="input pl-9"
                placeholder="Buscar nombre, empresa o teléfono..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-pais" className="sr-only">Filtrar por país</label>
            <select id="filtro-pais" className="select" value={filtroPais} onChange={(e) => setFiltroPais(e.target.value)}>
              <option value="todos">Todos los países</option>
              {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-tipo" className="sr-only">Filtrar por tipo de teléfono</label>
            <select id="filtro-tipo" className="select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos los tipos</option>
              <option value="movil">Móvil</option>
              <option value="fijo">Fijo</option>
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado" className="sr-only">Filtrar por estado</label>
            <select id="filtro-estado" className="select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as 'todos' | 'pendiente' | 'contesto' | 'no_contesto')}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="contesto">Contestó</option>
              <option value="no_contesto">No contestó</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de bloques */}
      <div ref={bloquesRef} className="space-y-3" role="list" aria-label="Bloques horarios de llamadas">
        {bloquesOrdenados.map((bloque) => {
          const contactosBloque = colaPorBloque.get(bloque.nombre) || [];
          const contestadosBloque = contactosBloque.filter(c => c.contesto === 1).length;
          const noContestadosBloque = contactosBloque.filter(c => c.no_contesto === 1).length;

          return (
            <section
              key={bloque.nombre}
              className="aima-card border-aima-border rounded-lg overflow-hidden"
              aria-labelledby={`bloque-${bloque.nombre.replace(/\s+/g, '-')}-title`}
            >
              {/* Header del bloque */}
              <div className="bg-aima-bg/50 border-b border-aima-border px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 id={`bloque-${bloque.nombre.replace(/\s+/g, '-')}-title`} className="text-sm font-semibold text-aima-text">
                    {bloque.nombre}
                  </h2>
                  <span className="text-[11px] text-aima-textMuted tabular-nums">
                    {bloque.inicio}–{bloque.fin} · {bloque.paises.join(' + ')}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 text-xs">
                  <span className="flex items-center gap-1 text-aima-success tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-aima-success" aria-hidden="true" />
                    {contestadosBloque}
                  </span>
                  <span className="flex items-center gap-1 text-aima-danger tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-aima-danger" aria-hidden="true" />
                    {noContestadosBloque}
                  </span>
                  <span className="text-aima-textMuted tabular-nums">
                    / {cantidadDelDia(bloque, diaSemana)}
                  </span>
                </div>
              </div>

              {/* Tarjetas del bloque */}
              <div className="p-2.5 space-y-2" role="list">
                {contactosBloque.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No hay contactos para este bloque"
                    description="Verifica los horarios o la base de datos."
                  />
                ) : (
                  contactosBloque.map((contacto, index) => (
                    <CallCard
                      key={contacto.id}
                      contacto={{ ...contacto, bloque, posicion: index + 1 }}
                      onActualizar={handleActualizarContacto}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}

        {bloquesOrdenados.length === 0 && (
          hayFiltros ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados con los filtros"
              description="Ajusta la búsqueda o quita filtros para ver más contactos."
            />
          ) : (
            <EmptyState
              icon={esFinDeSemana ? CalendarOff : Clock}
              title={esFinDeSemana ? 'Hoy no hay llamadas' : 'No hay cola programada para hoy'}
              description={esFinDeSemana
                ? 'Es fin de semana — las llamadas son de lunes a viernes.'
                : 'Verifique que hay contactos en la base de datos o importe el Excel.'}
              action={!esFinDeSemana && (
                <button onClick={cargarCola} className="btn-primary">
                  Recargar
                </button>
              )}
            />
          )
        )}
      </div>
    </div>
  );
}
