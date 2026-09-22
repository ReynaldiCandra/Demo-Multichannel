'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

/** Halaman login tampil polos tanpa sidebar; sisanya dibungkus AppShell. */
export function ShellGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
