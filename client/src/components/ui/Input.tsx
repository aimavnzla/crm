import { forwardRef, InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-3 py-2 rounded-lg bg-aima-bg border border-aima-border text-aima-text placeholder-aima-textMuted focus:outline-none focus:ring-2 focus:ring-aima-primary focus:border-transparent transition-all duration-150 ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';