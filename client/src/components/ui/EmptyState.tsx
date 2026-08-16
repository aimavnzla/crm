import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Estado vacío reutilizable (icono + título + descripción + acción opcional). */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="aima-card border-aima-border rounded-xl p-12 text-center">
      {Icon && (
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-aima-border/30 flex items-center justify-center text-aima-textMuted">
          <Icon className="w-8 h-8" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-medium text-aima-text mb-1">{title}</h3>
      {description && <p className="text-xs text-aima-textMuted max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
