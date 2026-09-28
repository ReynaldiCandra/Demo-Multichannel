'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useCrmAlerts } from '@/lib/api/hooks';
import { cn } from '@/lib/format';

/**
 * Lonceng notifikasi di topbar. Data di-polling tiap 30 detik oleh
 * useCrmAlerts (satu query dibagi semua halaman lewat cache React Query).
 * Isi awal: follow-up leads yang jatuh tempo / belum dijadwalkan.
 */
export function NotificationBell() {
  const alerts = useCrmAlerts();
  const [open, setOpen] = useState(false);

  const count = alerts.data?.count ?? 0;
  const items = alerts.data?.items ?? [];

  return (
    <div className="bell-wrap">
      <button
        type="button"
        className={cn('bell-button', count > 0 && 'bell-active')}
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifikasi (${count} perlu tindakan)`}
        aria-expanded={open}
        title="Notifikasi follow-up"
        data-testid="button-notification-bell"
      >
        <Bell size={17} />
        {count > 0 && (
          <span className="bell-badge" data-testid="bell-count">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="bell-menu" data-testid="bell-menu">
          <div className="bell-head">
            <strong>Perlu tindakan</strong>
            <span>{count} item</span>
          </div>
          {alerts.isLoading ? (
            <p className="bell-empty">Memuat…</p>
          ) : items.length === 0 ? (
            <p className="bell-empty">Tidak ada yang perlu di-follow up. 👍</p>
          ) : (
            <ul className="bell-list">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href="/crm" onClick={() => setOpen(false)} data-testid={`bell-item-${item.id}`}>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="bell-footer" href="/crm" onClick={() => setOpen(false)}>
            Buka CRM Leads →
          </Link>
        </div>
      )}
    </div>
  );
}
