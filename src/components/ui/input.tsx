'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

const sizeClasses = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
} as const;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  error?: string;
  size?: keyof typeof sizeClasses;
  prefix?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      size = 'md',
      prefix,
      suffix,
      id,
      wrapperClassName = '',
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 flex items-center text-muted-foreground pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-lg border bg-transparent
              transition-colors duration-150
              placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-destructive focus:ring-destructive' : 'border-input'}
              ${sizeClasses[size]}
              ${prefix ? 'pl-10' : ''}
              ${suffix ? 'pr-10' : ''}
              ${className}
            `}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error && inputId ? `${inputId}-error` : undefined}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 flex items-center text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
        {error && (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            className="text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
