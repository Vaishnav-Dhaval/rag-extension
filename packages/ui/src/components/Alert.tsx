import React from 'react';

export interface AlertProps {
  readonly variant?: 'success' | 'error' | 'warning' | 'info';
  readonly children: React.ReactNode;
  readonly onDismiss?: () => void;
}

const icons = {
  success: '✓',
  error: '⚠',
  warning: '!',
  info: 'ℹ',
};

const colors = {
  success: 'bg-green-50 text-green-900 border-green-200',
  error: 'bg-red-50 text-red-900 border-red-200',
  warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  info: 'bg-blue-50 text-blue-900 border-blue-200',
};

export function Alert({ variant = 'info', children, onDismiss }: AlertProps): JSX.Element {
  return (
    <div className={`rounded-md border p-4 flex gap-3 ${colors[variant]}`}>
      <span className="flex-shrink-0 font-bold">{icons[variant]}</span>
      <div className="flex-1 text-sm">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-xl leading-none opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
