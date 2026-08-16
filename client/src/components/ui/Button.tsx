import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }>(
  ({ className = '', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-aima-bg ${
          loading || disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-aima-border/80'
        } bg-aima-border text-aima-text ${className}`}
        {...props}
      >
        {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';