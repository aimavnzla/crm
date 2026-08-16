import { useState, useEffect } from 'react';
import { ChevronRight, PhoneOff } from 'lucide-react';
import { Contacto } from '../types';
import { useApi } from '../lib/api-context';
import { PAISES } from '../utils/schedule';
import { PageHeader, ErrorState, EmptyState } from './ui';
import { useEntrance } from '../lib/motion';

export function SinNumeroView() {
  const api = useApi();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paisesExpandidos, setPaisesExpandidos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        setError(null);
        const data = await api.getSinNumero();
        setContactos(data.data);
        // Inicializar todos los países como expandidos
        const expandidos: Record<string, boolean> = {};
        PAISES.forEach(p => { expandidos[p] = true; });
        setPaisesExpandidos(expandidos);
      } catch (err: any) {
        setError(err.message || 'Error cargando contactos sin número');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [api]);

  const togglePais = (pais: string) => {
    setPaisesExpandidos(prev => ({ ...prev, [pais]: !prev[pais] }));
  };

  const contactosPorPais = contactos.reduce((acc, c) => {
    if (!acc[c.pais]) acc[c.pais] = [];
    acc[c.pais].push(c);
    return acc;
  }, {} as Record<string, Contacto[]>);

  const gruposRef = useEntrance<HTMLDivElement>([contactos.length > 0], { y: 8, stagger: 0.04 });

  if (cargando) {
    return (
      <div className="space-y-4" role="status" aria-label="Cargando contactos sin número">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="aima-card border-aima-border rounded-xl p-4 animate-pulse">
            <div className="h-6 w-32 bg-aima-border rounded mb-3" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-10 bg-aima-border rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Error cargando contactos" message={error} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contactos Sin Número"
        subtitle={`${contactos.length} contactos sin teléfono válido · Agrupados por país`}
      />

      {contactos.length === 0 ? (
        <EmptyState
          icon={PhoneOff}
          title="No hay contactos sin número"
          description="Todos los contactos tienen teléfono válido o no se han importado."
        />
      ) : (
        <div ref={gruposRef} className="space-y-4" role="list" aria-label="Contactos sin número por país">
          {PAISES.map(pais => {
            const contactosPais = contactosPorPais[pais] || [];
            if (contactosPais.length === 0) return null;

            const expandido = paisesExpandidos[pais] !== false;

            return (
              <section
                key={pais}
                className="aima-card border-aima-border rounded-xl overflow-hidden"
                aria-labelledby={`pais-${pais}-title`}
              >
                <div
                  className="bg-aima-bg/50 border-b border-aima-border px-4 py-3 flex items-center justify-between"
                  onClick={() => togglePais(pais)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePais(pais); } }}
                  aria-expanded={expandido}
                  aria-controls={`pais-${pais}-content`}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      size={18}
                      strokeWidth={2}
                      className={`text-aima-textMuted transition-transform ${expandido ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <h2 id={`pais-${pais}-title`} className="font-semibold text-aima-text">{pais}</h2>
                    <span className="badge badge-gray">{contactosPais.length} contactos</span>
                  </div>
                </div>

                <div
                  id={`pais-${pais}-content`}
                  role="region"
                  aria-labelledby={`pais-${pais}-title`}
                  className={`${expandido ? '' : 'hidden'}`}
                >
                  <div className="p-4 space-y-2">
                    {contactosPais.map((contacto) => (
                      <article
                        key={contacto.id}
                        className="p-3 bg-aima-bg/50 rounded-lg border border-aima-border/50 hover:border-aima-primary/30 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-aima-text truncate">{contacto.nombre}</h3>
                              {contacto.empresa && (
                                <span className="badge badge-info">{contacto.empresa}</span>
                              )}
                            </div>
                            {contacto.website && (
                              <a
                                href={contacto.website.startsWith('http') ? contacto.website : `https://${contacto.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-aima-primaryHover hover:underline truncate block max-w-xs mt-1 inline-block"
                              >
                                {contacto.website}
                              </a>
                            )}
                            {contacto.nota && (
                              <p className="text-xs text-aima-textMuted mt-1 line-clamp-2">{contacto.nota}</p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
