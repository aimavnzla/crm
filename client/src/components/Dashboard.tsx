import { useState, useEffect, useCallback } from 'react';
import {
  Phone, CheckCircle2, PhoneOff, Lightbulb, CalendarCheck, Lock, Send,
  type LucideIcon,
} from 'lucide-react';
import { MetricasPeriodo, LlamadasPorDia } from '../types';
import { useApi } from '../lib/api-context';
import { DashboardSkeleton } from './skeletons/DashboardSkeleton';
import { MetricCard, PageHeader, ErrorState, EmptyState } from './ui';
import { useEntrance } from '../lib/motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LabelList,
} from 'recharts';

type Periodo = 'hoy' | 'semana' | 'mes';

/* Colores de gráfico validados contra el fondo oscuro #1a1230
   (ver index.css → --series-*). Todos ≥ 3:1. */
const AREA_STROKE = '#a855f7';       // línea del área (brand light)
const BAR_FILL = '#7c3aed';          // relleno de barras (brand)
const GRID = '#2d1b4e';              // gridline hairline
const AXIS_INK = '#9a8ab8';          // ink de ejes (muted)
const CURSOR = '#3d2a5e';            // crosshair

// Tooltip custom con la marca (sigue el método dataviz: superficie + hairline + ink).
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | string; dataKey: string | number; color?: string; fill?: string }>;
  label?: string;
  formatLabel?: (label: string) => string;
  formatValue?: (value: number | string) => string;
  unit?: string;
}

function ChartTooltip({ active, payload, label, formatLabel, formatValue, unit }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-aima-border bg-aima-bgCard px-3 py-2 shadow-aima-lg">
      {label && (
        <p className="text-[11px] text-aima-textMuted mb-1">
          {formatLabel ? formatLabel(label) : label}
        </p>
      )}
      {payload.map((p, i) => {
        const color = p.color || p.fill || '#a855f7';
        const text = formatValue ? formatValue(p.value) : String(p.value);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold text-aima-text tabular-nums">{text}</span>
            {unit && <span className="text-[11px] text-aima-textMuted">{unit}</span>}
          </div>
        );
      })}
    </div>
  );
}

interface TarjetaMetrica {
  label: string;
  value: number;
  icon: LucideIcon;
  chipClass: string;
  secondary: string;
}

export function Dashboard() {
  const api = useApi();
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [metricas, setMetricas] = useState<MetricasPeriodo | null>(null);
  const [serie, setSerie] = useState<LlamadasPorDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const [m, s] = await Promise.all([
        api.getMetricas(periodo),
        api.getSerieLlamadas(),
      ]);
      setMetricas(m);
      setSerie(s);
    } catch (err: any) {
      setError(err.message || 'Error cargando métricas');
    } finally {
      setCargando(false);
    }
  }, [periodo, api]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const metricasRef = useEntrance<HTMLDivElement>([metricas], { y: 8, stagger: 0.05 });

  if (cargando) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState title="Error cargando dashboard" message={error} onRetry={cargar} />;
  }

  if (!metricas) {
    return <EmptyState icon={Phone} title="No hay datos para mostrar" description="Importa contactos y registra llamadas para ver las métricas." />;
  }

  const tasaNoContestacion = 100 - metricas.tasa_contestacion;

  const tarjetasMetricas: TarjetaMetrica[] = [
    {
      label: 'Llamadas',
      value: metricas.llamadas_realizadas,
      icon: Phone,
      chipClass: 'bg-aima-primary/10 text-aima-primary',
      secondary: 'total del período',
    },
    {
      label: 'Contestaron',
      value: metricas.contestaron,
      icon: CheckCircle2,
      chipClass: 'bg-green-600/10 text-green-600',
      secondary: `${metricas.tasa_contestacion}% de contestación`,
    },
    {
      label: 'No contestaron',
      value: metricas.no_contestaron,
      icon: PhoneOff,
      chipClass: 'bg-aima-danger/10 text-aima-danger',
      secondary: `${tasaNoContestacion}% no contestó`,
    },
    {
      label: 'Interesados',
      value: metricas.interesados,
      icon: Lightbulb,
      chipClass: 'bg-amber-600/10 text-amber-600',
      secondary: `${metricas.tasa_interesados}% de quienes contestaron`,
    },
    {
      label: 'Agendaron',
      value: metricas.agendaron,
      icon: CalendarCheck,
      chipClass: 'bg-cyan-600/10 text-cyan-600',
      secondary: `${metricas.tasa_agenda}% de quienes contestaron`,
    },
    {
      label: 'Cerraron',
      value: metricas.cerraron,
      icon: Lock,
      chipClass: 'bg-pink-600/10 text-pink-600',
      secondary: `${metricas.tasa_cierre}% de quienes contestaron`,
    },
    {
      label: 'En seguimiento',
      value: metricas.en_seguimiento,
      icon: Send,
      chipClass: 'bg-aima-primary/10 text-aima-primary',
      secondary: `${metricas.seguimiento_info_enviada} con info enviada`,
    },
    {
      label: 'Respondieron',
      value: metricas.seguimiento_respondio,
      icon: CheckCircle2,
      chipClass: 'bg-green-600/10 text-green-600',
      secondary: `de ${metricas.en_seguimiento} en seguimiento`,
    },
  ];

  const etiquetaPeriodo = periodo === 'hoy' ? 'Hoy' : periodo === 'semana' ? 'Esta semana' : 'Este mes';
  const formatFechaCorta = (value: string) =>
    new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
  const formatFechaLarga = (value: string) =>
    new Date(value).toLocaleDateString('es-VE', { weekday: 'long', day: '2-digit', month: 'long' });

  const datosTasaPorPais = metricas.por_pais.map(p => ({
    pais: p.pais,
    tasa: p.llamadas > 0 ? Math.round((p.contestaron / p.llamadas) * 100) : 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={`Métricas del período: ${etiquetaPeriodo}`}
        actions={
          <div className="flex items-center gap-1 p-1 aima-card border-aima-border rounded-lg w-fit" role="tablist" aria-label="Período">
            {(['hoy', 'semana', 'mes'] as Periodo[]).map(p => (
              <button
                key={p}
                role="tab"
                aria-selected={periodo === p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  periodo === p
                    ? 'bg-aima-primary/15 text-aima-primary'
                    : 'text-aima-textMuted hover:text-aima-text'
                }`}
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        }
      />

      {/* Stat tiles — icono con color + valor en ink neutro (nunca color solo) */}
      <div ref={metricasRef} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {tarjetasMetricas.map((m, i) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
            chipClass={m.chipClass}
            secondary={m.secondary}
            delay={i * 60}
          />
        ))}
      </div>

      {/* Desglose por país (vista tabla del método) */}
      <div className="aima-card border-aima-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-aima-text mb-3">Desglose por País</h2>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full" role="grid" aria-label="Desglose de métricas por país">
            <thead>
              <tr className="border-b border-aima-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-aima-textMuted uppercase tracking-wider">País</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-aima-textMuted uppercase tracking-wider">Llamadas</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-aima-textMuted uppercase tracking-wider">Contestaron</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-aima-textMuted uppercase tracking-wider">No contestaron</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-aima-textMuted uppercase tracking-wider">Interesados</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-aima-textMuted uppercase tracking-wider">Agendaron</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-aima-textMuted uppercase tracking-wider">Cerraron</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aima-border/50">
              {metricas.por_pais.map((pais) => (
                <tr key={pais.pais} className="hover:bg-aima-bg/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="badge badge-purple">{pais.pais}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-aima-text tabular-nums">{pais.llamadas}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-aima-text tabular-nums">{pais.contestaron}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-aima-text tabular-nums">{pais.no_contestaron}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-aima-text tabular-nums">{pais.interesados}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-aima-text tabular-nums">{pais.agendaron}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-aima-text tabular-nums">{pais.cerraron}</td>
                </tr>
              ))}
              {metricas.por_pais.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-aima-textMuted">
                    No hay llamadas registradas en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico: Llamadas por día (una serie → sin leyenda; el título la nombra) */}
      <div className="aima-card border-aima-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-aima-text mb-1">Llamadas por Día</h2>
        <p className="text-xs text-aima-textMuted mb-4">Últimas 2 semanas</p>
        <div className="h-56" role="img" aria-label="Gráfico de llamadas por día en las últimas dos semanas">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLlamadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AREA_STROKE} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={AREA_STROKE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fill: AXIS_INK, fontSize: 11 }}
                tickFormatter={formatFechaCorta}
                axisLine={{ stroke: GRID }}
                tickLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: AXIS_INK, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: CURSOR, strokeDasharray: '3 3' }}
                content={<ChartTooltip unit="llamadas" formatLabel={formatFechaLarga} />}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={AREA_STROKE}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradLlamadas)"
                dot={false}
                activeDot={{ r: 4, fill: AREA_STROKE, stroke: '#1a1230', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico: Tasa de contestación por país (magnitud → matiz secuencial único) */}
      {datosTasaPorPais.length > 0 && (
        <div className="aima-card border-aima-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-aima-text mb-1">Tasa de Contestación por País</h2>
          <p className="text-xs text-aima-textMuted mb-4">% de llamadas contestadas</p>
          <div className="h-48" role="img" aria-label="Gráfico de barras con la tasa de contestación por país">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datosTasaPorPais}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 12, bottom: 0 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} strokeWidth={1} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: AXIS_INK, fontSize: 11 }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="pais"
                  width={76}
                  tick={{ fill: AXIS_INK, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#1f163a' }}
                  content={<ChartTooltip unit="% de contestación" />}
                />
                <Bar
                  dataKey="tasa"
                  fill={BAR_FILL}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                >
                  <LabelList
                    dataKey="tasa"
                    position="right"
                    formatter={(value: number) => `${value}%`}
                    fill={AXIS_INK}
                    fontSize={11}
                    offset={8}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
