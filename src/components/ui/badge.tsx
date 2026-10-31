'use client';

import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md';
}

const variants: Record<string, string> = {
  default: 'bg-secondary text-secondary-foreground',
  primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  destructive: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  outline: 'border border-border text-foreground',
};

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  const variantClass = variants[variant] || variants.default;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full transition-colors ${sizeClass} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
