'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Radio,
  ReceiptText,
  Search,
  Settings2,
  ShoppingBag,
  Store,
  Target,
  Truck,
  UsersRound,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/format';
import { useListModules, useSession } from '@/lib/api/hooks';
import { isModuleVisible } from '@/lib/modules';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  activePaths?: string[];
  exact?: boolean;
  badge?: string;
  moduleKey?: string;
};

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'WORKSPACE',
    items: [
      { href: '/', label: 'Dashboard Multichannel', icon: LayoutDashboard, moduleKey: 'dashboard' },
    ],
  },
  {
    label: 'OPERASIONAL',
    items: [
      {
        href: '/pos',
        label: 'Input Harian',
        icon: Pencil,
        activePaths: ['/pos'],
        exact: true,
        moduleKey: 'pos',
      },
      {
        href: '/pos/penjualan',
        label: 'Penjualan',
        icon: ShoppingBag,
        activePaths: ['/pos/penjualan'],
        moduleKey: 'pos',
      },
      { href: '/toko', label: 'Analisa Toko', icon: BarChart3, moduleKey: 'pos' },
      {
        href: '/pos/toko',
        label: 'Kanal & Toko',
        icon: Store,
        activePaths: ['/pos/toko'],
        moduleKey: 'pos',
      },
      {
        href: '/pos/produk',
        label: 'Produk & Stok',
        icon: Package,
        activePaths: ['/pos/produk'],
        moduleKey: 'pos',
      },
      { href: '/meta-ads', label: 'Biaya & Iklan', icon: Target, moduleKey: 'meta_ads' },
      { href: '/live', label: 'Live Selling', icon: Radio, moduleKey: 'live' },
      { href: '/suppliers', label: 'Daftar Suplier', icon: Truck },
    ],
  },
  {
    label: 'KEUANGAN',
    items: [
      { href: '/laporan', label: 'Settlement', icon: CircleDollarSign, moduleKey: 'laporan' },
      { href: '/jobs', label: 'Invoice', icon: ReceiptText, activePaths: [], moduleKey: 'jobs' },
    ],
  },
  {
    label: 'WORKFLOW',
    items: [
      { href: '/jobs', label: 'Freelance Ads', icon: BriefcaseBusiness, moduleKey: 'jobs' },
      { href: '/jobs', label: 'Kanban', icon: BarChart3, activePaths: [], moduleKey: 'jobs' },
    ],
  },
  {
    label: 'MANAJEMEN',
    items: [
      { href: '/pengaturan', label: 'Tim & Akses', icon: UsersRound, activePaths: [] },
      { href: '/pengaturan', label: 'Pengaturan', icon: Settings2 },
    ],
  },
];

const searchRoutes: Record<string, string> = {
  pos: '/pos',
  penjualan: '/pos/penjualan',
  produk: '/pos/produk',
  toko: '/pos/toko',
  kanal: '/pos/toko',
  analisa: '/toko',
  omzet: '/toko',
  ads: '/meta-ads',
  meta: '/meta-ads',
  job: '/jobs',
  jobs: '/jobs',
  live: '/live',
  supplier: '/suppliers',
  suplier: '/suppliers',
  laporan: '/laporan',
  setting: '/pengaturan',
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const session = useSession();
  const modules = useListModules();
  const user = session.data;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState('');

  const isNavActive = (item: NavItem) => {
    const paths = item.activePaths ?? [item.href];
    return paths.some((path) =>
      item.exact || path === '/'
        ? pathname === path
        : pathname === path || pathname.startsWith(`${path}/`),
    );
  };

  const visibleSections =
    modules.isSuccess && modules.data.length
      ? navSections
          .map((section) => ({
            ...section,
            items: section.items.filter(
              (item) =>
                !item.moduleKey ||
                isModuleVisible(item.moduleKey, modules.data, true),
            ),
          }))
          .filter((section) => section.items.length > 0)
      : navSections;
  const visibleNav = visibleSections.flatMap((section) => section.items);
  const current = visibleNav.find(isNavActive) ?? visibleNav[0] ?? navSections[0].items[0];

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim().toLowerCase();
    const destination = Object.entries(searchRoutes).find(([keyword]) =>
      query.includes(keyword),
    )?.[1];
    if (destination) router.push(destination);
    setSearch('');
  };

  return (
    <div className={cn('app-shell', sidebarCollapsed && 'sidebar-is-collapsed')}>
      <aside
        className={cn(
          'sidebar',
          menuOpen && 'sidebar-open',
          sidebarCollapsed && 'sidebar-collapsed',
        )}
      >
        <div className="brand">
          <Image
            className="brand-logo brand-logo-full"
            src="/branding/websensial-logo.png"
            alt="Websensial"
            width={876}
            height={198}
            priority
          />
          <Image
            className="brand-logo brand-logo-mark"
            src="/branding/websensial-mark.png"
            alt="Websensial"
            width={256}
            height={256}
            priority
          />
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
            title={sidebarCollapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <div className="sidebar-menu">
          {visibleSections.map((section) => (
            <div className="sidebar-group" key={section.label}>
              <div className="sidebar-kicker">{section.label}</div>
              <nav className="side-nav">
                {section.items.map((item) => {
                  const { href, label, icon: Icon, badge } = item;
                  return (
                    <Link
                      key={`${section.label}-${label}`}
                      href={href}
                      className={cn('side-link', isNavActive(item) && 'active')}
                      data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                      {badge && <span className="nav-badge">{badge}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="operator">
            <span className="avatar">{initials(user?.name ?? '')}</span>
            <div className="operator-copy">
              <strong>{user?.name ?? '—'}</strong>
              <small>{user?.role === 'demo' ? 'mode demo' : 'solo operator'}</small>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Tutup menu"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu"
            data-testid="button-open-menu"
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-tools">
            <form className="workspace-search" onSubmit={submitSearch}>
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari menu atau aktivitas"
                aria-label="Cari menu atau aktivitas"
                data-testid="input-workspace-search"
              />
            </form>
            <div className="topbar-right">
              <span className="live-pulse">
                <i /> sinkron aktif
              </span>
              <span className="today" suppressHydrationWarning>
                {new Intl.DateTimeFormat('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                }).format(new Date())}
              </span>
            </div>
            <div className="account-wrap">
              <button
                className="account-control"
                onClick={() => setAccountOpen((value) => !value)}
                aria-expanded={accountOpen}
                data-testid="button-account-menu"
              >
                <span className="avatar">{initials(user?.name ?? '')}</span>
                <span className="account-copy">
                  <strong>{user?.name ?? '—'}</strong>
                  <small>{user?.role === 'demo' ? 'mode demo' : 'solo operator'}</small>
                </span>
                <ChevronRight
                  size={14}
                  className={cn('account-chevron', accountOpen && 'account-chevron-open')}
                />
              </button>
              {accountOpen && (
                <div className="account-menu">
                  <strong>{user?.email ?? 'Workspace pribadi'}</strong>
                  <span>
                    {user?.role === 'demo'
                      ? 'Mode demo — hanya bisa melihat'
                      : 'Data tersimpan otomatis'}
                  </span>
                  <Link
                    href="/pengaturan"
                    onClick={() => setAccountOpen(false)}
                    data-testid="link-account-settings"
                  >
                    Buka pengaturan
                  </Link>
                  <button
                    className="account-logout"
                    onClick={logout}
                    data-testid="button-logout"
                  >
                    <LogOut size={13} /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
