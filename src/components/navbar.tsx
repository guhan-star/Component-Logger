'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  FileSpreadsheet,
  Receipt,
  ScanLine,
  SlidersHorizontal,
  FolderKanban,
  ArrowDownLeft,
  ShoppingCart,
  Sun,
  Moon,
  Plus,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from './theme-provider';

export const navItems = [
  { name: 'Inventory', href: '/components', icon: Boxes },
  { name: 'Import / Export', href: '/import-export', icon: FileSpreadsheet },
  { name: 'Receipt Review', href: '/receipt-review', icon: Receipt },
  { name: 'Component ID', href: '/identify', icon: ScanLine },
  { name: 'Dropdown Management', href: '/settings', icon: SlidersHorizontal },
  { name: 'Projects & BOM', href: '/projects', icon: FolderKanban },
  { name: 'Custody & Loans', href: '/loans', icon: ArrowDownLeft },
  { name: 'Purchase Pipeline', href: '/purchase-list', icon: ShoppingCart },
];

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = React.useState<{ name: string; email: string; role: string } | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (pathname === '/login' || pathname === '/register') {
      setUser(null);
      return;
    }
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else setUser(null);
      })
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const isAuthPage = pathname === '/login' || pathname === '/register';

  return (
    <header className="h-[60px] border-b border-[var(--line)] bg-[var(--panel)] flex items-center justify-between px-5 sticky top-0 z-40 select-none">
      {/* Brand line */}
      <div className="flex items-center gap-3">
        <Link href={isAuthPage ? '/login' : '/components'} className="flex items-center gap-2.5">
          <span className="brand font-bold tracking-wider text-xs text-[var(--amber)]">STARK INDUSTRIES WMC</span>
          <span className="text-[var(--line)]">|</span>
          <strong className="text-sm font-semibold tracking-wide text-[var(--text)]">Inventory Control</strong>
        </Link>
      </div>

      {/* Operator Status & Controls */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs text-[var(--text)] font-semibold leading-tight">
                  {user.name}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted)] leading-tight">
                  {user.email}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full border border-[var(--amber)] text-[var(--amber)] bg-[var(--amber)]/10">
                OPERATOR MAIN
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--red)] text-[var(--muted)] hover:text-[var(--red)] px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </>
        ) : (
          !isAuthPage && (
            <Link
              href="/login"
              className="text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--amber)] px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )
        )}

        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle theme"
          className="text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] px-2.5 py-1 rounded transition-colors min-w-[96px] h-7 flex items-center justify-center gap-1.5"
        >
          {mounted ? (
            theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[var(--amber)]" />
                <span>Light theme</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[var(--amber)]" />
                <span>Dark theme</span>
              </>
            )
          ) : (
            <span className="inline-block w-16 h-3 opacity-0" />
          )}
        </button>
      </div>
    </header>
  );
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  // Hide sidebar on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--line)] bg-[var(--panel)] p-3 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-60px)]">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href === '/components' && pathname === '/') ||
            (item.href !== '/components' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
                isActive
                  ? 'bg-[var(--panel2)] text-[var(--text)] font-semibold border-l-2 border-[var(--amber)] pl-2.5'
                  : 'text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-[var(--amber)] opacity-90" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <div className="flex md:hidden overflow-x-auto py-2 px-3 space-x-1 border-b border-[var(--line)] bg-[var(--panel)] scrollbar-none">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="px-2.5 py-1 text-xs whitespace-nowrap text-[var(--muted)] hover:text-[var(--text)] rounded bg-[var(--panel2)]"
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
};
