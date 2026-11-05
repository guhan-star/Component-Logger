'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  FolderKanban,
  ArrowDownLeft,
  ShoppingCart,
  Users,
  SlidersHorizontal,
  User as UserIcon,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Check,
  Shield,
  Layers,
  Palette,
  FileSpreadsheet,
  ScanLine,
  Receipt,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortName?: string;
}

export const primaryNavItems: NavItem[] = [
  { name: 'Overview', shortName: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Inventory', shortName: 'Inventory', href: '/components', icon: Boxes },
  { name: 'Projects', shortName: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Custody & Loans', shortName: 'Custody', href: '/loans', icon: ArrowDownLeft },
  { name: 'Purchases', shortName: 'Purchases', href: '/purchase-list', icon: ShoppingCart },
  { name: 'Friends & Team', shortName: 'Friends', href: '/friends', icon: Users },
  { name: 'Settings', shortName: 'Settings', href: '/settings', icon: SlidersHorizontal },
];

export const secondaryNavItems: NavItem[] = [
  { name: 'Receipt Review', shortName: 'Receipts', href: '/receipt-review', icon: Receipt },
  { name: 'Component Scanner', shortName: 'Scanner', href: '/identify', icon: ScanLine },
  { name: 'Import / Export', shortName: 'Data I/O', href: '/import-export', icon: FileSpreadsheet },
];

// Navigation Context for Mobile Drawer & Quick Search
interface NavContextType {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const NavContext = createContext<NavContextType>({
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  searchOpen: false,
  setSearchOpen: () => {},
});

export const useNavigation = () => useContext(NavContext);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
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
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </NavContext.Provider>
  );
};

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleDrawer, searchOpen, setSearchOpen } = useNavigation();

  const [user, setUser] = useState<{
    id?: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
  } | null>(null);

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [pendingNotifs, setPendingNotifs] = useState<{
    invitations: Array<{ id: string; project: { name: string }; role: string }>;
    friendRequests: Array<{ id: string; sender: { name: string; username: string } }>;
  }>({ invitations: [], friendRequests: [] });

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch current user and pending notifications
  useEffect(() => {
    if (pathname === '/login' || pathname === '/register') {
      setUser(null);
      return;
    }

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          // Fetch genuine notifications (project invitations & friend requests)
          Promise.all([
            fetch('/api/invitations').then((r) => r.json()).catch(() => ({ invitations: [] })),
            fetch('/api/friends/requests').then((r) => r.json()).catch(() => ({ requests: [] })),
          ]).then(([invData, friendData]) => {
            setPendingNotifs({
              invitations: invData.invitations || [],
              friendRequests: friendData.requests || [],
            });
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setUserDropdownOpen(false);
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const totalNotifications = pendingNotifs.invitations.length + pendingNotifs.friendRequests.length;

  return (
    <>
      <header className="h-[56px] lg:h-[60px] border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-md sticky top-0 z-40 select-none">
        <div className="max-w-[1780px] mx-auto h-full flex items-center justify-between px-3 sm:px-5 lg:px-6">
          {/* 1. BRAND IDENTITY & LOGO */}
          <div className="flex items-center gap-3 shrink-0">
            {!isAuthPage && (
              <button
                onClick={toggleDrawer}
                type="button"
                aria-label="Toggle navigation drawer"
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel2)] border border-[var(--line)] transition-colors active:scale-95"
              >
                <Menu className="w-4 h-4 text-[var(--amber)]" />
              </button>
            )}

            <Link href="/" className="flex items-center gap-2 group">
              {/* Industrial Chevron / Monogram */}
              <div className="w-8 h-8 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center group-hover:border-[var(--amber)] transition-colors shrink-0">
                <span className="font-mono font-black text-xs text-[var(--amber)] tracking-tighter">
                  &gt;&gt;
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-sm tracking-wider text-[var(--text)] uppercase whitespace-nowrap">
                  MOVEON <span className="text-[var(--amber)] font-bold">WMC</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>
            </Link>
          </div>

          {/* 2. MOVEON CENTER NAVIGATION TABS (Desktop >= 1024px) */}
          {!isAuthPage && (
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 h-full mx-4 overflow-x-auto no-scrollbar">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 h-[36px] rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'text-[var(--amber)] bg-[var(--panel2)] font-semibold shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel2)]/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--amber)]' : 'opacity-70'}`} />
                    <span>{item.name}</span>
                    {isActive && (
                      <span className="absolute bottom-0 inset-x-2 h-[2px] bg-[var(--amber)] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* 3. RIGHT CONTROLS: Quick Search, Notification, User Menu (NO THEME BUTTON) */}
          <div className="flex items-center gap-2 shrink-0">
            {!isAuthPage && (
              <>
                {/* Global Quick Search Button */}
                <button
                  onClick={() => setSearchOpen(true)}
                  type="button"
                  title="Search inventory (Ctrl+K)"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-xs text-[var(--muted)] transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-[var(--amber)]" />
                  <span className="hidden xl:inline text-[11px]">Search components...</span>
                  <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">
                    /
                  </kbd>
                </button>

                {/* Notifications Bell Dropdown */}
                <div className="relative" ref={notifMenuRef}>
                  <button
                    onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                    type="button"
                    aria-label="View notifications"
                    className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] transition-colors"
                  >
                    <Bell className="w-4 h-4 text-[var(--muted)] hover:text-[var(--text)]" />
                    {totalNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--amber)] text-[#17120a] font-mono font-bold text-[9px] flex items-center justify-center border border-[var(--panel)]">
                        {totalNotifications}
                      </span>
                    )}
                  </button>

                  {/* Notification floating drawer */}
                  {notifDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                        <span className="font-bold text-xs uppercase tracking-wider text-[var(--text)]">
                          Notifications
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--panel2)] text-[var(--muted)]">
                          {totalNotifications} active
                        </span>
                      </div>

                      <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
                        {totalNotifications === 0 ? (
                          <div className="p-4 text-center text-[var(--muted)] text-xs">
                            <Check className="w-5 h-5 mx-auto mb-1 text-emerald-500 opacity-80" />
                            All caught up. No pending project or team notices.
                          </div>
                        ) : (
                          <>
                            {pendingNotifs.invitations.map((inv) => (
                              <Link
                                key={inv.id}
                                href="/projects"
                                onClick={() => setNotifDropdownOpen(false)}
                                className="block p-2 rounded-lg bg-[var(--panel2)] hover:border-[var(--amber)] border border-transparent transition-colors"
                              >
                                <div className="font-semibold text-[var(--text)]">Project Invitation</div>
                                <div className="text-[11px] text-[var(--muted)]">
                                  Invited to join <span className="text-[var(--amber)]">{inv.project.name}</span> as {inv.role}
                                </div>
                              </Link>
                            ))}
                            {pendingNotifs.friendRequests.map((fr) => (
                              <Link
                                key={fr.id}
                                href="/friends"
                                onClick={() => setNotifDropdownOpen(false)}
                                className="block p-2 rounded-lg bg-[var(--panel2)] hover:border-[var(--amber)] border border-transparent transition-colors"
                              >
                                <div className="font-semibold text-[var(--text)]">Friend Request</div>
                                <div className="text-[11px] text-[var(--muted)]">
                                  <span className="text-[var(--amber)]">@{fr.sender.username}</span> sent you a collaboration request
                                </div>
                              </Link>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* User Avatar & Dropdown */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  type="button"
                  aria-label="User account menu"
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--panel2)] transition-colors"
                >
                  <div className="relative w-8 h-8 rounded-full bg-[var(--amber)]/15 border border-[var(--amber)]/40 overflow-hidden flex items-center justify-center text-xs font-bold text-[var(--amber)] uppercase">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name?.[0] || 'U'
                    )}
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--panel)]" />
                  </div>
                  <ChevronDown className="w-3 h-3 text-[var(--muted)] hidden sm:block" />
                </button>

                {/* Account Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 border-b border-[var(--line)]">
                      <div className="font-bold text-[var(--text)] truncate">{user.name}</div>
                      <div className="text-[10px] font-mono text-[var(--muted)] truncate">{user.email}</div>
                      <div className="mt-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border border-[var(--amber)]/40 bg-[var(--amber)]/10 text-[var(--amber)]">
                          {user.role}
                        </span>
                      </div>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <Link
                        href="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[var(--text)] hover:bg-[var(--panel2)] hover:text-[var(--amber)] transition-colors"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-[var(--muted)]" />
                        <span>Profile & Engineering ID</span>
                      </Link>

                      <Link
                        href="/profile?tab=preferences"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[var(--text)] hover:bg-[var(--panel2)] hover:text-[var(--amber)] transition-colors"
                      >
                        <Palette className="w-3.5 h-3.5 text-[var(--amber)]" />
                        <span>Appearance & Theme</span>
                      </Link>

                      <Link
                        href="/settings"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[var(--text)] hover:bg-[var(--panel2)] hover:text-[var(--amber)] transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--muted)]" />
                        <span>Master Data Taxonomy</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-[var(--line)]">
                      <button
                        onClick={handleLogout}
                        type="button"
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out of WMC</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !isAuthPage && (
                <div className="flex items-center gap-1.5">
                  <Link
                    href="/login"
                    className="text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-xs bg-[var(--amber)] hover:bg-[var(--amber)]/90 text-[#17120a] font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </header>

      {/* 4. GLOBAL SEARCH MODAL */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[var(--amber)] uppercase">
                <Search className="w-4 h-4" />
                <span>Quick Component Finder</span>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem('q') as HTMLInputElement;
                if (input?.value) {
                  router.push(`/components?search=${encodeURIComponent(input.value.trim())}`);
                  setSearchOpen(false);
                }
              }}
              className="relative"
            >
              <input
                name="q"
                autoFocus
                placeholder="Search by SKU, MPN, component name, or category..."
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-hidden focus:border-[var(--amber)]"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 px-2.5 py-1 rounded bg-[var(--amber)] text-[#17120a] font-bold text-[11px]"
              >
                Search
              </button>
            </form>

            <div className="text-[11px] text-[var(--muted)] pt-1 flex items-center justify-between">
              <span>Press Enter to navigate directly to filtered inventory</span>
              <span className="font-mono text-[10px]">ESC to cancel</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Top navigation is primary; Sidebar serves as compact collapsible side nav if rendered
export const Sidebar: React.FC = () => {
  return null; // Top navigation bar replaces left sidebar for full-width MOVEON design
};

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { drawerOpen, closeDrawer, toggleDrawer } = useNavigation();
  const [user, setUser] = useState<{ name: string; email: string; role: string; avatarUrl?: string | null } | null>(null);

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

  // Primary 4 tabs for Mobile Bottom Bar + Menu button
  const bottomBarTabs = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Inventory', href: '/components', icon: Boxes },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Custody', href: '/loans', icon: ArrowDownLeft },
  ];

  return (
    <>
      {/* 1. FIXED MOBILE BOTTOM NAVIGATION BAR (NO THEME BUTTON) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[var(--panel)]/95 backdrop-blur-lg border-t border-[var(--line)] shadow-2xl safe-area-pb"
      >
        <div className="grid grid-cols-5 h-[58px] items-center px-1">
          {bottomBarTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              tab.href === '/'
                ? pathname === '/'
                : pathname === tab.href || pathname.startsWith(tab.href + '/');

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
                  isActive ? 'text-[var(--amber)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
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
                drawerOpen ? 'scale-110 bg-[var(--amber)]/10 text-[var(--amber)]' : ''
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

      {/* 2. FULL SLIDE-OVER MOBILE DRAWER (NO THEME BUTTON) */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden flex justify-end"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={closeDrawer}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs sm:max-w-sm bg-[var(--panel)] h-full shadow-2xl flex flex-col border-l border-[var(--line)] z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center">
                  <span className="font-mono font-black text-xs text-[var(--amber)]">&gt;&gt;</span>
                </div>
                <span className="font-bold text-xs uppercase tracking-wider text-[var(--text)]">
                  WMC Navigation
                </span>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel2)] border border-[var(--line)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User card in mobile drawer */}
            {user && (
              <div className="p-3 mx-3 my-2 rounded-xl bg-[var(--panel2)] border border-[var(--line)] flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[var(--amber)]/20 border border-[var(--amber)]/40 overflow-hidden flex items-center justify-center text-xs font-bold text-[var(--amber)]">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name?.[0] || 'U'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[var(--text)] truncate">{user.name}</div>
                  <div className="text-[10px] font-mono text-[var(--muted)] truncate">{user.email}</div>
                </div>
              </div>
            )}

            {/* Primary Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-[var(--amber)] px-2 py-1 uppercase">
                Core Operations
              </div>
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--panel2)] text-[var(--amber)] font-bold border-l-2 border-[var(--amber)]'
                        : 'text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[var(--amber)]" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <div className="text-[10px] font-mono font-bold tracking-widest text-[var(--amber)] px-2 pt-3 py-1 uppercase">
                Procurement & Tools
              </div>
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--panel2)] text-[var(--amber)] font-bold border-l-2 border-[var(--amber)]'
                        : 'text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[var(--muted)]" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <div className="text-[10px] font-mono font-bold tracking-widest text-[var(--amber)] px-2 pt-3 py-1 uppercase">
                Account & Preferences
              </div>
              <Link
                href="/profile"
                onClick={closeDrawer}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]"
              >
                <UserIcon className="w-4 h-4 text-[var(--muted)]" />
                <span>Profile & Engineering ID</span>
              </Link>
              <Link
                href="/profile?tab=preferences"
                onClick={closeDrawer}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]"
              >
                <Palette className="w-4 h-4 text-[var(--amber)]" />
                <span>Appearance & Theme Settings</span>
              </Link>
            </div>

            {/* Footer without theme selector */}
            <div className="p-3 border-t border-[var(--line)] bg-[var(--panel2)]/60 safe-area-pb">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--red)] border border-[var(--red)]/30 hover:bg-[var(--red)]/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
