import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lightbulb, CalendarCheck, Mail, MessageCircle, Globe, Search, RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Contacto, UpdateContactoPayload } from '../types';
import { useApi } from '../lib/api-context';
import { PageHeader, ErrorState, EmptyState } from './ui';
import { useEntrance } from '../lib/motion';

/** Botón de un control segmentado (Pendiente/Enviado, No respondió/Respondió). */
function SegButton({
  activo,
  onClick,
  children,
  color = 'default',
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'default' | 'success' | 'danger';
}) {
  const clases =
    color === 'success'
      ? 'text-aima-success'
      : color === 'danger'
        ? 'text-aima-danger'
        : 'text-aima-text';
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
        activo ? `bg-aima-primary/15 ${clases}` : 'text-aima-textMuted hover:text-aima-text'
      }`}
    >
      {children}
    </button>
  );
}

export function SeguimientoView() {
  const api = useApi();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const data = await api.getSeguimiento();
      setContactos(data.data);
    } catch (err: any) {
      setError(err.message || 'Error cargando seguimiento');
    } finally {
      setCargando(false);
    }
  }, [api]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = useCallback(async (original: Contacto, cambios: UpdateContactoPayload) => {
    // Actualización optimista: reflejar el cambio de inmediato
    setContactos(prev => prev.map(x => (x.id === original.id ? { ...x, ...cambios } : x)));
    try {
      const actualizado = await api.updateContacto(original.id, cambios);
      setContactos(prev => prev.map(x => (x.id === original.id ? actualizado : x)));
    } catch {
      setContactos(prev => prev.map(x => (x.id === original.id ? original : x)));
      alert('Error al guardar el seguimiento. Intente de nuevo.');
    }
  }, []);

  const toggleEnvio = (c: Contacto) =>
    guardar(c, { seguimiento_envio: c.seguimiento_envio === 1 ? 0 : 1 });

  const toggleRespuesta = (c: Contacto) =>
    guardar(c, { seguimiento_respuesta: c.seguimiento_respuesta === 1 ? 0 : 1 });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return contactos;
    return contactos.filter(c =>
      `${c.nombre} ${c.empresa || ''} ${c.telefono || ''}`.toLowerCase().includes(q)
    );
  }, [contactos, busqueda]);

  const respondieron = contactos.filter(c => c.seguimiento_respuesta === 1).length;
  const conInfoEnviada = contactos.filter(c => c.seguimiento_envio === 1).length;

  const listaRef = useEntrance<HTMLDivElement>([filtrados.length > 0], { y: 8, stagger: 0.04 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Seguimiento"
        subtitle={`${contactos.length} en seguimiento · ${conInfoEnviada} con info enviada · ${respondieron} respondieron`}
        actions={
          <button onClick={cargar} className="btn-secondary text-sm" disabled={cargando}>
            <RefreshCw size={14} strokeWidth={2} className={`mr-2 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Actualizar
          </button>
        }
      />

      {/* Búsqueda */}
      <div className="aima-card border-aima-border rounded-xl p-3">
        <label htmlFor="busqueda-seg" className="sr-only">Buscar en seguimiento</label>
        <div className="relative">
          <Search size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-aima-textMuted" aria-hidden="true" />
          <input
            id="busqueda-seg"
            type="text"
            className="input pl-9"
            placeholder="Buscar por nombre, empresa o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {cargando && (
        <div className="space-y-3" role="status" aria-label="Cargando seguimiento">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aima-card border-aima-border rounded-xl p-4 animate-pulse">
              <div className="h-5 w-48 bg-aima-border rounded mb-2" />
              <div className="h-4 w-64 bg-aima-border rounded" />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorState title="Error cargando seguimiento" message={error} onRetry={cargar} />}

      {!cargando && !error && contactos.length === 0 && (
        <EmptyState
          icon={Lightbulb}
          title="No hay contactos en seguimiento"
          description="Cuando marques un contacto como Interesado o que Agendó en la cola de hoy, aparecerá aquí para hacerle seguimiento."
        />
      )}

      {!cargando && !error && contactos.length > 0 && filtrados.length === 0 && (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          description={`No se encontraron contactos para “${busqueda}”.`}
        />
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div ref={listaRef} className="space-y-3" role="list" aria-label="Contactos en seguimiento">
          {filtrados.map((contacto) => (
            <SeguimientoCard
              key={contacto.id}
              contacto={contacto}
              onToggleEnvio={() => toggleEnvio(contacto)}
              onToggleRespuesta={() => toggleRespuesta(contacto)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeguimientoCard({
  contacto,
  onToggleEnvio,
  onToggleRespuesta,
}: {
  contacto: Contacto;
  onToggleEnvio: () => void;
  onToggleRespuesta: () => void;
}) {
  const badges: Array<{ label: string; icon: LucideIcon; clase: string }> = [];
  if (contacto.interesado === 1) {
    badges.push({ label: 'Interesado', icon: Lightbulb, clase: 'badge-warning' });
  }
  if (contacto.agendo === 1) {
    badges.push({ label: 'Agendó', icon: CalendarCheck, clase: 'badge-info' });
  }

  return (
    <article
      className="aima-card border-aima-border rounded-xl p-4"
      aria-label={`Seguimiento de ${contacto.nombre}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Info del contacto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-aima-text truncate">{contacto.nombre}</h2>
            {badges.map(b => {
              const Icon = b.icon;
              return (
                <span key={b.label} className={`badge ${b.clase}`}>
                  <Icon size={11} strokeWidth={2} className="mr-1" aria-hidden="true" />
                  {b.label}
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-aima-textMuted flex-wrap">
            {contacto.telefono && (
              <span className="font-mono text-aima-text tabular-nums">{contacto.telefono}</span>
            )}
            <span>{contacto.pais}{contacto.tipo_telefono === 'fijo' ? ' (Fijo)' : ' (Móvil)'}</span>
            {contacto.empresa && <span>· {contacto.empresa}</span>}
          </div>

          {(contacto.website || contacto.info_enviada_email === 1 || contacto.info_enviada_whatsapp === 1) && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {contacto.website && (
                <a
                  href={contacto.website.startsWith('http') ? contacto.website : `https://${contacto.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-aima-primaryHover hover:underline truncate max-w-[12rem]"
                >
                  <Globe size={11} strokeWidth={1.7} aria-hidden="true" />
                  <span className="truncate">{contacto.website}</span>
                </a>
              )}
              {contacto.info_enviada_email === 1 && (
                <span className="badge badge-purple text-[10px]">
                  <Mail size={10} strokeWidth={2} className="mr-1" aria-hidden="true" /> Email
                </span>
              )}
              {contacto.info_enviada_whatsapp === 1 && (
                <span className="badge badge-purple text-[10px]">
                  <MessageCircle size={10} strokeWidth={2} className="mr-1" aria-hidden="true" /> WhatsApp
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controles de seguimiento */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-aima-textMuted uppercase tracking-wide">Info</span>
            <div className="flex rounded-lg overflow-hidden border border-aima-border bg-aima-bg/40" role="group" aria-label="Estado de envío de información">
              <SegButton activo={contacto.seguimiento_envio !== 1} onClick={onToggleEnvio}>
                Pendiente
              </SegButton>
              <SegButton activo={contacto.seguimiento_envio === 1} onClick={onToggleEnvio} color="success">
                Enviado
              </SegButton>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-aima-textMuted uppercase tracking-wide">Respuesta</span>
            <div className="flex rounded-lg overflow-hidden border border-aima-border bg-aima-bg/40" role="group" aria-label="Respuesta del contacto">
              <SegButton activo={contacto.seguimiento_respuesta !== 1} onClick={onToggleRespuesta} color="danger">
                No respondió
              </SegButton>
              <SegButton activo={contacto.seguimiento_respuesta === 1} onClick={onToggleRespuesta} color="success">
                Respondió
              </SegButton>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
