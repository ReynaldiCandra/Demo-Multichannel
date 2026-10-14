import type { ReactNode } from 'react';

export default function PengaturanLayout({ children }: { children: ReactNode }) {
  return <div className="settings-page settings-shell">{children}</div>;
}
