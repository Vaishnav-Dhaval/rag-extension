import React from 'react';

export interface SpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly label?: string;
}

export function Spinner({ size = 'md', label }: SpinnerProps): JSX.Element {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizeClass} border-3 border-neutral-300 border-t-blue-600 rounded-full animate-spin`} />
      {label && <p className="text-sm text-neutral-600">{label}</p>}
    </div>
  );
}
