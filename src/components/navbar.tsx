'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  LogOut,
  User as UserIcon,
  Users,
  Menu,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useTheme } from './theme-provider';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortName?: string;
}

export const navItems: NavItem[] = [
  { name: 'Inventory', shortName: 'Inventory', href: '/components', icon: Boxes },
  { name: 'Custody & Loans', shortName: 'Custody', href: '/loans', icon: ArrowDownLeft },
  { name: 'Projects & BOM', shortName: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Friends & Team', shortName: 'Friends', href: '/friends', icon: Users },
  { name: 'Purchase Pipeline', shortName: 'Purchases', href: '/purchase-list', icon: ShoppingCart },
  { name: 'Receipt Review', shortName: 'Receipts', href: '/receipt-review', icon: Receipt },
  { name: 'Component ID', shortName: 'Scanner', href: '/identify', icon: ScanLine },
  { name: 'Import / Export', shortName: 'Data I/O', href: '/import-export', icon: FileSpreadsheet },
  { name: 'Dropdown Management', shortName: 'Settings', href: '/settings', icon: SlidersHorizontal },
];

// Navigation Context for Mobile Drawer
interface NavContextType {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const NavContext = createContext<NavContextType>({
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
});

export const useNavigation = () => useContext(NavContext);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [drawerOpen]);

  return (
    <NavContext.Provider
      value={{
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        toggleDrawer: () => setDrawerOpen((prev) => !prev),
      }}
    >
      {children}
    </NavContext.Provider>
  );
};

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { toggleDrawer } = useNavigation();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
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
    <header className="h-[56px] sm:h-[60px] border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-5 sticky top-0 z-40 select-none">
      {/* Left side: Hamburger button (Mobile) + Brand */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {!isAuthPage && (
          <button
            onClick={toggleDrawer}
            type="button"
            aria-label="Open navigation menu"
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel2)] border border-transparent hover:border-[var(--line)] transition-colors active:scale-95"
          >
            <Menu className="w-5 h-5 text-[var(--amber)]" />
          </button>
        )}

        <Link
          href={isAuthPage ? '/login' : '/components'}
          className="flex items-center gap-1.5 sm:gap-2.5 truncate"
        >
          {/* Logo emblem */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center shrink-0">
            <span className="font-mono font-black text-xs sm:text-sm text-[var(--amber)]">S</span>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold tracking-wider text-xs sm:text-sm text-[var(--amber)] uppercase whitespace-nowrap">
              Stark <span className="hidden xs:inline">Industries</span>
            </span>
            <span className="text-[var(--line)] hidden sm:inline">|</span>
            <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded border border-[var(--amber)]/40 bg-[var(--amber)]/10 text-[var(--amber)] font-bold">
              WMC
            </span>
            <span className="hidden lg:inline text-xs font-medium text-[var(--muted)] truncate">
              Inventory Control
            </span>
          </div>
        </Link>
      </div>

      {/* Right side: Theme toggle & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Compact Theme Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle theme"
          className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-2.5 sm:h-8 rounded-lg text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] transition-all active:scale-95"
        >
          {mounted ? (
            theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-[var(--amber)]" />
                <span className="hidden sm:inline ml-1.5 text-[11px] font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[var(--amber)]" />
                <span className="hidden sm:inline ml-1.5 text-[11px] font-medium">Dark</span>
              </>
            )
          ) : (
            <span className="w-4 h-4" />
          )}
        </button>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs text-[var(--text)] font-semibold leading-tight truncate max-w-[120px]">
                {user.name}
              </span>
              <span className="text-[10px] font-mono text-[var(--muted)] leading-tight truncate max-w-[120px]">
                {user.email}
              </span>
            </div>

            <span className="hidden xs:inline-block text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full border border-[var(--amber)] text-[var(--amber)] bg-[var(--amber)]/10">
              {user.role || 'MEMBER'}
            </span>

            {/* User Avatar Circle */}
            <div className="w-8 h-8 rounded-full bg-[var(--amber)]/15 border border-[var(--amber)]/40 flex items-center justify-center text-xs font-bold text-[var(--amber)] uppercase">
              {user.name ? user.name[0] : 'U'}
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="hidden md:flex items-center gap-1 text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--red)] text-[var(--muted)] hover:text-[var(--red)] px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          !isAuthPage && (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <UserIcon className="w-3.5 h-3.5 text-[var(--muted)]" />
                <span className="hidden xs:inline">Sign In</span>
              </Link>
              <Link
                href="/register"
                className="text-xs bg-[var(--amber)] hover:bg-[var(--amber)]/90 text-black font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <span className="hidden xs:inline">Join</span>
                <span className="xs:hidden">+</span>
              </Link>
            </div>
          )
        )}
      </div>
    </header>
  );
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

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
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-[var(--panel2)] text-[var(--text)] font-semibold border-l-2 border-[var(--amber)] pl-2.5 shadow-xs'
                  : 'text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-[var(--amber)] opacity-90" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[var(--line)] text-[10px] font-mono text-[var(--muted)] flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>STARK OS v2.6 // ONLINE</span>
      </div>
    </aside>
  );
};

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { drawerOpen, closeDrawer, toggleDrawer } = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
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
      closeDrawer();
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (pathname === '/login' || pathname === '/register') return null;

  // Primary 4 tabs for Bottom Bar + Menu
  const bottomBarTabs = [
    { name: 'Inventory', href: '/components', icon: Boxes },
    { name: 'Custody', href: '/loans', icon: ArrowDownLeft },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Friends', href: '/friends', icon: Users },
  ];

  return (
    <>
      {/* 1. FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[var(--panel)]/95 backdrop-blur-lg border-t border-[var(--line)] shadow-2xl safe-area-pb"
      >
        <div className="grid grid-cols-5 h-[58px] items-center px-1">
          {bottomBarTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              pathname === tab.href ||
              (tab.href === '/components' && pathname === '/') ||
              (tab.href !== '/components' && pathname.startsWith(tab.href));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
                  isActive
                    ? 'text-[var(--amber)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-transform ${
                    isActive ? 'scale-110 bg-[var(--amber)]/10' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 leading-none ${
                    isActive ? 'font-bold text-[var(--amber)]' : 'font-medium'
                  }`}
                >
                  {tab.name}
                </span>
              </Link>
            );
          })}

          {/* 5th Tab: Menu trigger */}
          <button
            type="button"
            onClick={toggleDrawer}
            className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              drawerOpen ? 'text-[var(--amber)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <div
              className={`p-1 rounded-lg transition-transform ${
                drawerOpen ? 'scale-110 bg-[var(--amber)]/10' : ''
              }`}
            >
              <Menu className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] tracking-tight mt-0.5 leading-none ${
                drawerOpen ? 'font-bold text-[var(--amber)]' : 'font-medium'
              }`}
            >
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* 2. SLIDE-OVER MOBILE DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-[310px] bg-[var(--panel)] border-r border-[var(--line)] shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--panel2)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--amber)]/15 border border-[var(--amber)]/40 flex items-center justify-center">
                  <span className="font-mono font-bold text-xs text-[var(--amber)]">S</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--amber)] tracking-wider uppercase">
                    Stark Industries
                  </div>
                  <div className="text-[10px] font-mono text-[var(--muted)]">
                    WMC Warehouse System
                  </div>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel)] border border-[var(--line)]"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Account / Identity Section */}
            <div className="p-3.5 border-b border-[var(--line)] bg-[var(--bg)]/50">
              {user ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[var(--amber)]/15 border border-[var(--amber)]/40 flex items-center justify-center text-sm font-bold text-[var(--amber)] uppercase shrink-0">
                      {user.name ? user.name[0] : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text)] truncate">
                        {user.name}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--muted)] truncate">
                        {user.email}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-[var(--amber)]/40 text-[var(--amber)] bg-[var(--amber)]/10 shrink-0">
                      {user.role || 'MEMBER'}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--text)]">Guest Mode</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Local sandbox enabled. Sign in to sync across team devices.
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href="/login"
                      onClick={closeDrawer}
                      className="py-1.5 text-center text-xs font-semibold border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] rounded-lg transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={closeDrawer}
                      className="py-1.5 text-center text-xs font-semibold bg-[var(--amber)] hover:bg-[var(--amber)]/90 text-black rounded-lg transition-colors"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Links (All 9 Tools) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--muted)] uppercase px-2 py-1">
                Workspace Tools
              </div>
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
                    onClick={closeDrawer}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--panel2)] text-[var(--amber)] font-bold border-l-2 border-[var(--amber)] shadow-xs'
                        : 'text-[var(--text)] hover:bg-[var(--panel2)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-[var(--amber)]' : 'text-[var(--muted)]'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] opacity-60" />
                  </Link>
                );
              })}
            </div>

            {/* Drawer Footer: Theme Toggle & Version */}
            <div className="p-3 border-t border-[var(--line)] bg-[var(--panel2)]/70 space-y-2.5 safe-area-pb">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Theme Mode</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] text-xs font-medium hover:border-[var(--amber)] transition-colors"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-[var(--amber)]" />
                      <span>Switch to Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[var(--amber)]" />
                      <span>Switch to Dark</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-[10px] font-mono text-[var(--muted)] flex items-center justify-between pt-1 border-t border-[var(--line)]/50">
                <span>STARK OS v2.6</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
