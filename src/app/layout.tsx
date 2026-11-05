import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Header, MobileNav, NavigationProvider } from '@/components/navbar';
import { Analytics } from '@vercel/analytics/react';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Component Logger | Industrial Electronics Inventory Control',
  description: 'Professional industrial warehouse management and component logging platform inspired by MOVEON.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--amber)]/20 selection:text-[var(--amber)] bg-circuit-grid">
        <ThemeProvider>
          <NavigationProvider>
            <Suspense fallback={<div className="h-[56px] lg:h-[60px] border-b border-[var(--line)] bg-[var(--panel)]" />}>
              <Header />
            </Suspense>

            {/* Mobile Bottom Navigation & Slide-over Drawer */}
            <Suspense fallback={null}>
              <MobileNav />
            </Suspense>

            <main className="flex-1 p-3 sm:p-5 lg:p-6 pb-20 md:pb-6 max-w-[1780px] w-full mx-auto overflow-x-hidden">
              <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--muted)] font-mono">Loading telemetry workspace...</div>}>
                {children}
              </Suspense>
            </main>
          </NavigationProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
