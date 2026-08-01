import React from 'react';
import type { JSX } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly loading?: boolean;
  readonly children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => {
    const variantClass = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
      secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    }[variant];

    const sizeClass = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          rounded-md font-medium
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClass}
          ${sizeClass}
          ${className}
        `}
        {...props}
      >
        {loading && <LoadingSpinner size={size === 'sm' ? 'sm' : 'md'} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

function LoadingSpinner({ size }: { size: 'sm' | 'md' }): JSX.Element {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return <div className={`${sizeClass} border-2 border-current border-t-transparent rounded-full animate-spin`} />;
}
