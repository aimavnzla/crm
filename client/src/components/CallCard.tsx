import { useState, useCallback, type ComponentType } from 'react';
import {
  Phone, PhoneOff, Clock, Lightbulb, XCircle, CalendarCheck, Check,
  Mail, MessageCircle, Globe, Loader2, type LucideProps,
} from 'lucide-react';
import { ContactoCola } from '../types';
import { useApi } from '../lib/api-context';

interface CallCardProps {
  contacto: ContactoCola;
  onActualizar: (contacto: ContactoCola) => void;
}

type Icono = ComponentType<LucideProps>;

const acciones: Array<{ campo: 'interesado' | 'rechazado' | 'agendo' | 'cerrado' | 'info_enviada_email' | 'info_enviada_whatsapp'; label: string; icon: Icono }> = [
  { campo: 'interesado', label: 'Interesado', icon: Lightbulb },
  { campo: 'rechazado', label: 'Rechazado', icon: XCircle },
  { campo: 'agendo', label: 'Agendó', icon: CalendarCheck },
  { campo: 'cerrado', label: 'Cerrado', icon: Check },
  { campo: 'info_enviada_email', label: 'Email', icon: Mail },
  { campo: 'info_enviada_whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export function CallCard({ contacto, onActualizar }: CallCardProps) {
  const api = useApi();
  const [datos, setDatos] = useState({
    contesto: (contacto.contesto ?? 0) as 0 | 1,
    no_contesto: (contacto.no_contesto ?? 0) as 0 | 1,
    interesado: contacto.interesado ?? 0,
    rechazado: contacto.rechazado ?? 0,
    agendo: contacto.agendo ?? 0,
    cerrado: contacto.cerrado ?? 0,
    info_enviada_email: contacto.info_enviada_email ?? 0,
    info_enviada_whatsapp: contacto.info_enviada_whatsapp ?? 0,
    clasificacion: contacto.clasificacion ?? null,
    nota: contacto.nota ?? '',
  });

  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Save on explicit action (not auto-save)
  const guardar = useCallback(async () => {
    setGuardando(true);
    try {
      const actualizado = await api.updateContacto(contacto.id, datos);
      setDatos(prev => ({
        ...prev,
        ...actualizado,
        contesto: actualizado.contesto ?? 0,
        no_contesto: actualizado.no_contesto ?? 0,
        interesado: actualizado.interesado ?? 0,
        rechazado: actualizado.rechazado ?? 0,
        agendo: actualizado.agendo ?? 0,
        cerrado: actualizado.cerrado ?? 0,
        info_enviada_email: actualizado.info_enviada_email ?? 0,
        info_enviada_whatsapp: actualizado.info_enviada_whatsapp ?? 0,
        nota: actualizado.nota ?? '',
      }));
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
      onActualizar({ ...contacto, ...actualizado });
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar. Intente de nuevo.');
    } finally {
      setGuardando(false);
    }
  }, [contacto.id, datos, onActualizar]);

  // Save wrapper that calls guardar after state update
  const guardarConEstado = useCallback((nuevosDatos: typeof datos) => {
    setDatos(nuevosDatos);
    guardar();
  }, [guardar]);

  const handleContesto = (valor: 0 | 1) => {
    setDatos(prev => {
      const nuevos = valor === 1
        ? { ...prev, contesto: 1 as 0 | 1, no_contesto: 0 as 0 | 1 }
        : { ...prev, contesto: 0 as 0 | 1 };
      guardarConEstado(nuevos);
      return nuevos;
    });
  };

  const handleNoContesto = (valor: 0 | 1) => {
    setDatos(prev => {
      const nuevos = valor === 1
        ? { ...prev, no_contesto: 1 as 0 | 1, contesto: 0 as 0 | 1 }
        : { ...prev, no_contesto: 0 as 0 | 1 };
      guardarConEstado(nuevos);
      return nuevos;
    });
  };

  const handleToggle = (campo: keyof typeof datos, valor: 0 | 1 | string | null) => {
    setDatos(prev => {
      const nuevos = { ...prev, [campo]: valor } as typeof datos;
      guardarConEstado(nuevos);
      return nuevos;
    });
  };

  const getEstadoColor = () => {
    if (datos.contesto === 1) return 'text-aima-success';
    if (datos.no_contesto === 1) return 'text-aima-danger';
    return 'text-aima-textMuted';
  };

  const getEstadoTexto = () => {
    if (datos.contesto === 1) return 'Contestó';
    if (datos.no_contesto === 1) return 'No contestó';
    return 'Pendiente';
  };

  const radioClase = (activo: boolean, color: 'success' | 'danger' | 'muted') =>
    `text-xs font-medium flex items-center gap-1.5 ${activo ? `text-aima-${color}` : 'text-aima-textMuted'}`;

  const estadoPendiente = datos.contesto === 0 && datos.no_contesto === 0;

  return (
    <article
      className="aima-card border-aima-border rounded-lg p-3"
      aria-label={`Llamada a ${contacto.nombre}`}
    >
      {/* Línea principal: nombre + estado */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-semibold truncate ${getEstadoColor()}`}>{contacto.nombre}</span>
            {contacto.empresa && (
              <span className="text-[10px] text-aima-textMuted truncate">· {contacto.empresa}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-aima-textMuted flex-wrap">
            {contacto.telefono && <span className="font-mono text-aima-text tabular-nums">{contacto.telefono}</span>}
            <span>{contacto.pais}{contacto.tipo_telefono === 'fijo' ? ' (Fijo)' : ' (Móvil)'}</span>
            {contacto.website && (
              <a
                href={contacto.website.startsWith('http') ? contacto.website : `https://${contacto.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-aima-primaryHover transition-colors truncate max-w-[10rem]"
                aria-label={`Visitar ${contacto.website}`}
              >
                <Globe size={12} strokeWidth={1.7} aria-hidden="true" />
                <span className="truncate">{contacto.website}</span>
              </a>
            )}
            <span className="text-aima-textMuted/80">{contacto.bloque.inicio}–{contacto.bloque.fin}</span>
          </div>
        </div>
        <span
          className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${getEstadoColor().replace('text-', 'bg-')}`}
          title={getEstadoTexto()}
          aria-label={`Estado: ${getEstadoTexto()}`}
        />
      </div>

      {/* Resultado: Contestó / No contestó / Pendiente */}
      <fieldset className="mb-1.5" aria-label="Resultado de la llamada">
        <legend className="sr-only">Resultado de la llamada</legend>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`contesto-${contacto.id}`}
              className="radio"
              checked={datos.contesto === 1}
              onChange={() => handleContesto(1)}
              aria-label="Contestó"
            />
            <span className={radioClase(datos.contesto === 1, 'success')}>
              <Phone size={13} strokeWidth={1.7} aria-hidden="true" />
              Contestó
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`contesto-${contacto.id}`}
              className="radio"
              checked={datos.no_contesto === 1}
              onChange={() => handleNoContesto(1)}
              aria-label="No contestó"
            />
            <span className={radioClase(datos.no_contesto === 1, 'danger')}>
              <PhoneOff size={13} strokeWidth={1.7} aria-hidden="true" />
              No contestó
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`contesto-${contacto.id}`}
              className="radio"
              checked={estadoPendiente}
              onChange={() => { handleContesto(0); handleNoContesto(0); }}
              aria-label="Pendiente"
            />
            <span className={radioClase(estadoPendiente, 'muted')}>
              <Clock size={13} strokeWidth={1.7} aria-hidden="true" />
              Pendiente
            </span>
          </label>
        </div>
      </fieldset>

      {/* Acciones (solo si contestó) */}
      {datos.contesto === 1 && (
        <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {acciones.map(a => {
            const Icon = a.icon;
            return (
              <label key={a.campo} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={datos[a.campo] === 1}
                  onChange={(e) => handleToggle(a.campo, e.target.checked ? 1 : 0)}
                  aria-label={a.label}
                />
                <span className={`text-xs flex items-center gap-1 ${datos[a.campo] === 1 ? 'text-aima-text' : 'text-aima-textMuted'}`}>
                  <Icon size={13} strokeWidth={1.7} aria-hidden="true" />
                  {a.label}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Clasificación y nota */}
      <div className="flex flex-col sm:flex-row gap-1.5 mt-1.5">
        <select
          id={`clasificacion-${contacto.id}`}
          className="select flex-1 !py-1.5 !px-2.5 text-xs"
          value={datos.clasificacion || ''}
          onChange={(e) => handleToggle('clasificacion', (e.target.value || null) as 'Bien' | 'Normal' | 'Mal' | null)}
          aria-label="Clasificación de la llamada"
        >
          <option value="">— Clasificación —</option>
          <option value="Bien">Bien</option>
          <option value="Normal">Normal</option>
          <option value="Mal">Mal</option>
        </select>
        <textarea
          id={`nota-${contacto.id}`}
          className="input flex-1 !py-1.5 !px-2.5 text-xs resize-y"
          value={datos.nota}
          onChange={(e) => handleToggle('nota', e.target.value)}
          placeholder="Nota de la llamada..."
          aria-label="Nota de la llamada"
          rows={1}
        />
      </div>

      {/* Pie: posición + guardado */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-aima-border/60">
        <span className="text-[10px] text-aima-textMuted tabular-nums">Posición #{contacto.posicion}</span>
        <div className="flex items-center gap-2">
          {guardando && (
            <span className="text-[10px] text-aima-warning flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              Guardando…
            </span>
          )}
          {guardado && !guardando && (
            <span className="text-[10px] text-aima-success flex items-center gap-1">
              <Check size={12} strokeWidth={2} aria-hidden="true" />
              Guardado
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
