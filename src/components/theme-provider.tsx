'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import ThemeTransitionOverlay from './theme-transition-overlay';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeOrigin {
  x: number;
  y: number;
}

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  setThemeWithOrigin: (theme: Theme, origin?: ThemeOrigin) => void;
  toggleTheme: (origin?: ThemeOrigin) => void;
}

const defaultContextValue: ThemeContextValue = {
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  setThemeWithOrigin: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

const STORAGE_KEY = 'electroparts-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyThemeClasses(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  // Load initial theme from localStorage without flash
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
    const initialResolved = resolveTheme(stored);
    setThemeState(stored);
    setResolvedTheme(initialResolved);
    applyThemeClasses(initialResolved);
  }, []);

  // Listen to OS theme changes if user has chosen 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        const nextResolved = mql.matches ? 'dark' : 'light';
        setResolvedTheme(nextResolved);
        applyThemeClasses(nextResolved);
      }
    };

    mql.addEventListener('change', handleSystemChange);
    return () => mql.removeEventListener('change', handleSystemChange);
  }, [theme]);

  // Set theme with optional physical screen origin for the energy wave transition
  const setThemeWithOrigin = useCallback(
    (newTheme: Theme, origin?: ThemeOrigin) => {
      const currentResolved = resolveTheme(theme);
      const nextResolved = resolveTheme(newTheme);

      setThemeState(newTheme);
      setResolvedTheme(nextResolved);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newTheme);
      }

      // If themes are different and we have window/event support
      if (typeof window !== 'undefined') {
        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches;

        if (origin && !prefersReducedMotion && currentResolved !== nextResolved) {
          // Trigger the slow branching organic energy wave transition
          window.dispatchEvent(
            new CustomEvent('start-theme-transition', {
              detail: {
                origin,
                targetTheme: nextResolved,
                currentTheme: currentResolved,
              },
            })
          );
        } else {
          // Direct switch (reduced motion or same theme or no origin provided)
          applyThemeClasses(nextResolved);
        }
      }
    },
    [theme]
  );

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeWithOrigin(newTheme);
    },
    [setThemeWithOrigin]
  );

  const toggleTheme = useCallback(
    (origin?: ThemeOrigin) => {
      const next: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
      setThemeWithOrigin(next, origin);
    },
    [resolvedTheme, setThemeWithOrigin]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        setThemeWithOrigin,
        toggleTheme,
      }}
    >
      {children}
      <ThemeTransitionOverlay />
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
