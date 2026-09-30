/**
 * Ikon toast ala aplikasi perbankan: setiap jenis aksi punya ikon sendiri —
 * ceklis untuk berhasil disimpan, pensil untuk edit, tempat sampah untuk
 * hapus, dll. Dipakai oleh useInvalidating di src/lib/api/hooks.ts lewat
 * toast.success(message, { icon: toastIcon(kind) }).
 */
import {
  BadgeCheck,
  CheckCircle2,
  Pencil,
  Power,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

export type ToastKind =
  | 'created' // data baru ditambahkan
  | 'updated' // data diedit
  | 'deleted' // data dihapus
  | 'paid' // pembayaran / pencairan
  | 'toggled' // on/off (modul, host aktif)
  | 'saved'; // simpan umum

type ToastIconSpec = { Icon: LucideIcon; className: string };

const TOAST_ICONS: Record<ToastKind, ToastIconSpec> = {
  created: { Icon: CheckCircle2, className: 'toast-icon toast-icon-good' },
  saved: { Icon: CheckCircle2, className: 'toast-icon toast-icon-good' },
  updated: { Icon: Pencil, className: 'toast-icon toast-icon-good' },
  deleted: { Icon: Trash2, className: 'toast-icon toast-icon-danger' },
  paid: { Icon: BadgeCheck, className: 'toast-icon toast-icon-good' },
  toggled: { Icon: Power, className: 'toast-icon toast-icon-good' },
};

export function toastIcon(kind: ToastKind) {
  const { Icon, className } = TOAST_ICONS[kind] ?? TOAST_ICONS.saved;
  return <Icon size={17} className={className} strokeWidth={2.2} />;
}
