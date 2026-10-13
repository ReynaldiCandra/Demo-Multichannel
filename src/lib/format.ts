export function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

import { BRAND_LOGOS, channelBrandClass } from './brand-logos';

/**
 * Logo marketplace asli (SVG simple-icons) + warna brand dari nama kanal
 * bebas ("TikTok Shop", "shopee", dst). Kanal yang tidak punya ikon
 * simple-icons (Lazada, Tokopedia) → null, supaya pemanggil pakai fallback
 * inisial berwarna brand (channelBrandClass).
 */
export function channelBrandLogo(channel: string): { hex: string; path: string } | null {
  const key = channel.toLowerCase().trim();
  if (BRAND_LOGOS[key]) return BRAND_LOGOS[key];
  // Pencocokan santai: "TikTok Shop" → tiktok, "Gumroad (Digital)" → gumroad.
  for (const [brand, logo] of Object.entries(BRAND_LOGOS)) {
    if (key.includes(brand)) return logo;
  }
  return null;
}

export { channelBrandClass };

export const money = (value: number | string | null | undefined = 0) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const number = (value: number | string | null | undefined = 0) =>
  new Intl.NumberFormat('id-ID').format(Number(value) || 0);

/**
 * Link wa.me dari nomor bebas (boleh ada spasi/strip/tanda +, awalan 0 atau
 * 62). `null` kalau tidak ada digit sama sekali supaya pemanggil bisa
 * menyembunyikan tombolnya.
 */
export function waLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : '—';

export const monthNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })
  .format(new Date())
  .slice(0, 7);

export const monthValue = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  const text = String(value ?? '');
  if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? monthNow : parsed.toISOString().slice(0, 7);
};

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(`${monthValue(month)}-01T00:00:00`),
  );

/**
 * Tanggal hari ini menurut WIB.
 *
 * Sebelumnya memakai toISOString() yang berbasis UTC, sehingga input antara
 * 00:00-06:59 WIB mendapat tanggal kemarin. Server memakai zona yang sama.
 */
export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
