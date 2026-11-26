'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface SunMoonToggleProps {
  theme: 'light' | 'dark' | 'system';
  size?: number;
  className?: string;
}

export function SunMoonToggle({
  theme,
  size = 20,
  className = '',
}: SunMoonToggleProps) {
  const isLight = theme === 'light';

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden transition-transform duration-500 ease-out ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Sun Icon */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${
          isLight
            ? 'opacity-100 rotate-0 scale-100'
            : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
        } text-[var(--amber)]`}
      >
        <Sun className="w-full h-full stroke-[2.2]" />
      </div>

      {/* Moon Icon */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform ${
          !isLight
            ? 'opacity-100 rotate-0 scale-100'
            : 'opacity-0 rotate-90 scale-50 pointer-events-none'
        } text-[var(--amber)]`}
      >
        <Moon className="w-full h-full stroke-[2.2]" />
      </div>
    </div>
  );
}
