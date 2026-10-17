'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, Eye, EyeOff, Package, RefreshCw, X, type LucideIcon, type LucideProps } from 'lucide-react';
import { useState } from 'react';
import { useListChannelLogos } from '@/lib/api/hooks';
import { channelBrandClass, channelBrandLogo, cn } from '@/lib/format';

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'compact';
}) {
  return (
    <button className={cn('btn', `btn-${variant}`, size === 'compact' ? 'btn-compact' : '', className)} {...props}>
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'switch',
        checked && 'switch-on',
        disabled && 'switch-disabled',
      )}
    >
      <span className="switch-track" />
      <span className="switch-thumb" />
      {label && <span className="switch-label">{label}</span>}
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  ...props
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'yellow';
} & HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(`badge badge-${tone}`, className)} {...props}>{children}</span>;
}

export function Panel({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('panel', className)} {...props}>
      {children}
    </section>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function State({
  type,
  onRetry,
}: {
  type: 'loading' | 'error' | 'empty';
  onRetry?: () => void;
}) {
  if (type === 'loading') {
    return (
      <div className="state">
        <Skeleton className="state-icon" />
        <Skeleton className="state-line" />
        <Skeleton className="state-line short" />
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="state">
        <CircleAlert size={24} />
        <strong>Data belum bisa dimuat</strong>
        <span>Coba segarkan lagi dalam beberapa detik.</span>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw size={15} /> Muat ulang
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="state">
      <Package size={24} />
      <strong>Belum ada data</strong>
      <span>Tambahkan catatan pertama untuk mulai melihat aktivitas di sini.</span>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Formulir</div>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
            data-testid="button-close-modal"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Permintaan konfirmasi yang dirender ConfirmDialog (mis. dari tabel). */
export type ConfirmRequest = {
  message: string;
  onConfirm: () => void;
};

/**
 * Dialog konfirmasi in-app menggantikan window.confirm() (Fase 7):
 * bergaya sama dengan modal lain, fokus keyboard tetap di UI, dan aman
 * dipakai berulang lewat props message + onConfirm.
 */
export function ConfirmDialog({
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  danger = true,
  pending = false,
  onConfirm,
  onClose,
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="confirm-dialog">
        <p>{message}</p>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
            data-testid="button-confirm-dialog"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ImagePreviewButton({
  src,
  alt,
  size = 'thumb',
  avatar = false,
  emptyLabel = '—',
}: {
  src: string | null | undefined;
  alt: string;
  size?: 'thumb' | 'small';
  /** Tampil bulat kecil (untuk logo toko / foto host), tetap bisa diklik untuk diperbesar. */
  avatar?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!src)
    return (
      <span
        className={`product-thumb product-thumb-empty ${avatar ? 'product-thumb-avatar' : ''} ${
          size === 'small' ? 'product-thumb-small' : ''
        }`}
      >
        {emptyLabel}
      </span>
    );

  return (
    <>
      <button
        type="button"
        className={`image-preview-button ${size === 'small' ? 'image-preview-button-small' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={`Lihat ${alt}`}
        title={`Lihat ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className={`product-thumb ${avatar ? 'product-thumb-avatar' : ''}`}
          loading="lazy"
        />
      </button>
      {open && (
        <Modal title={alt} onClose={() => setOpen(false)}>
          <img src={src} alt={alt} className="image-lightbox" />
        </Modal>
      )}
    </>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination-btn"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft size={15} />
      </button>
      {pages.map((pageNumber) => (
        <button
          type="button"
          key={pageNumber}
          className={`pagination-btn ${pageNumber === page ? 'active' : ''}`}
          onClick={() => onPageChange(pageNumber)}
          aria-current={pageNumber === page ? 'page' : undefined}
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        className="pagination-btn"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Halaman berikutnya"
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}

/**
 * Input password dengan tombol ikon mata (tampilkan/sembunyikan) di kanan.
 * Toggle-nya type="button" supaya tidak ikut submit form.
 */
/**
 * Avatar kanal, diprioritorkan: (1) logo kanal hasil upload di Pengaturan
 * (dipakai SEMUA halaman otomatis — satu fetch dibagi via react-query),
 * (2) logo/foto toko terkait, (3) logo marketplace asli (SVG simple-icons
 * di tile warna brand), (4) fallback inisial huruf berwarna brand.
 */
export function ChannelAvatar({
  channel,
  image,
  className,
}: {
  channel: string;
  image?: string | null;
  className?: string;
}) {
  // Logo custom per kanal; error/401 hanya berarti kembali ke fallback di bawah.
  const logos = useListChannelLogos();
  const channelKey = channel.toLowerCase().trim();
  const customLogo = logos.data?.logos.find((logo) => logo.channelKey === channelKey)?.logoUrl;
  const src = customLogo ?? image ?? null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        title={channel}
        className={cn('marketplace-avatar', 'rt-avatar-img', className)}
      />
    );
  }
  const brand = channelBrandLogo(channel);
  if (brand) {
    return (
      <span
        className={cn('marketplace-avatar', className)}
        style={{ background: `#${brand.hex}` }}
        title={channel}
      >
        <svg viewBox="0 0 24 24" fill="hsl(0 0% 100%)" className="rt-brand-logo" aria-hidden="true">
          <path d={brand.path} />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={cn('marketplace-avatar', channelBrandClass(channel), className)}
      title={channel}
    >
      {channel.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-wrap">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('password-input', className)}
      />
      <button
        type="button"
        className="password-eye"
        tabIndex={-1}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={visible}
        onClick={() => setVisible((prev) => !prev)}
        data-testid="button-toggle-password"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function KpiCard({
  label,
  value,
  meta,
  accent = 'navy',
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down';
}) {
  return (
    <Panel className={`kpi-card accent-${accent}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong className="kpi-value">{value}</strong>
      {meta && (
        <div
          className={cn(
            'kpi-meta',
            trend === 'up' && 'positive',
            trend === 'down' && 'negative',
          )}
        >
          {meta}
        </div>
      )}
    </Panel>
  );
}
