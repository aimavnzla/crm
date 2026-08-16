import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/** Estado de error reutilizable (icono + mensaje + reintentar opcional). */
export function ErrorState({ title = 'Ocurrió un error', message, onRetry }: ErrorStateProps) {
  return (
    <div className="aima-card border-aima-border rounded-xl p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-aima-danger/10 flex items-center justify-center text-aima-danger">
        <AlertTriangle className="w-6 h-6" strokeWidth={1.7} aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-aima-text mb-1">{title}</h3>
      <p className="text-xs text-aima-textMuted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-4">
          Reintentar
        </button>
      )}
    </div>
  );
}
