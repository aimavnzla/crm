import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../lib/motion';

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Clases Tailwind literales para el chip del icono (p. ej. "bg-aima-primary/10 text-aima-primary"). */
  chipClass: string;
  /** Clases para el valor (por defecto texto del tema). */
  valueClass?: string;
  /** Línea de contexto bajo el valor (p. ej. "45% de contestación"). */
  secondary?: string;
  /** Retraso del count-up en ms (para escalonar tiles). */
  delay?: number;
  /** Versión compacta para la ventana de bloque */
  compact?: boolean;
}

/** Stat tile del dashboard: icono + label + valor animado + contexto. */
export function MetricCard({
  label,
  value,
  icon: Icon,
  chipClass,
  valueClass = 'text-aima-text',
  secondary,
  delay = 0,
  compact = false,
}: MetricCardProps) {
  const animValue = useCountUp(value, { delay });

  if (compact) {
    return (
      <article className="aima-card border-aima-border rounded-lg p-2.5 flex flex-col items-center gap-1.5 text-center">
        <span
          className={`w-7 h-7 shrink-0 rounded flex items-center justify-center ${chipClass}`}
          aria-hidden="true"
        >
          <Icon className="w-[14px] h-[14px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-wider text-aima-textMuted truncate">{label}</p>
          <p className={`text-lg font-medium tabular-nums leading-tight truncate ${valueClass}`}>{animValue}</p>
          {secondary && <p className="text-[9px] text-aima-textMuted truncate">{secondary}</p>}
        </div>
      </article>
    );
  }

  return (
    <article className="aima-card border-aima-border rounded-xl p-4 flex items-center gap-3">
      <span
        className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${chipClass}`}
        aria-hidden="true"
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-aima-textMuted truncate">{label}</p>
        <p className={`text-2xl font-light tabular-nums leading-tight truncate ${valueClass}`}>{animValue}</p>
        {secondary && <p className="text-[11px] text-aima-textMuted truncate">{secondary}</p>}
      </div>
    </article>
  );
}
