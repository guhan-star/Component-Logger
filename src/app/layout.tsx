import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Header, Sidebar, MobileNav } from '@/components/navbar';
import { Analytics } from '@vercel/analytics/react';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Stark Industries WMC | Inventory Control',
  description: 'Industrial-grade local-first electronics inventory and warehouse management control system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <ThemeProvider>
          <Suspense fallback={<div className="h-[60px] border-b border-[var(--line)] bg-[var(--panel)]" />}>
            <Header />
          </Suspense>

          {/* Mobile navigation tab bar */}
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>

          <div className="flex-1 flex w-full">
            <Suspense fallback={<div className="w-56 border-r border-[var(--line)] bg-[var(--panel)]" />}>
              <Sidebar />
            </Suspense>
            <main className="flex-1 p-4 sm:p-6 max-w-[1700px] w-full mx-auto overflow-x-hidden">
              <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--muted)] font-mono">Loading operations workspace...</div>}>
                {children}
              </Suspense>
            </main>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
