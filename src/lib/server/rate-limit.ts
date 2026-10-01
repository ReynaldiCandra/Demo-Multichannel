import 'server-only';

/**
 * Rate-limit in-memory untuk endpoint publik (login) — hardening pra-beta.
 *
 * Catatan batasan (diterima untuk skala saat ini):
 *  - Penyimpanan per-proses. Di Vercel tiap instance lambda punya Map sendiri,
 *    jadi limit efektifnya `limit × jumlah instance hangat`. Cukup untuk
 *    memperlambat brute-force; kalau nanti butuh ketat per-IP lintas instance,
 *    ganti ke penyimpanan bersama (mis. Upstash Redis) di fase 5.
 *  - Di belakang proxy/CDN, IP diambil dari header standar (x-forwarded-for),
 *    jadi pemanggil jahat idealnya tidak bisa memalsukannya di Vercel; lokal
 *    / proxy lain bisa — ini lapisan perlambat, bukan pengganti auth.
 *  - Kunci per-email membatasi serangan terarah ke satu akun; kunci per-IP
 *    membatasi spray banyak akun dari satu mesin.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Batas ukuran Map supaya flooding kunci palsu tidak membongkar memori. */
const MAX_KEYS = 10_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Catat satu percobaan untuk `key`. Return ok=false ketika `limit` terlampaui
 * dalam jendela `windowMs`, beserta berapa detik lagi jendela di-reset.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Map tidak tumbuh tanpa batas: sekali-sekali buang entri kedaluwarsa,
  // dan kalau tetap penuh (kunci palsu bermunculan), buang yang terlama.
  if (buckets.size > MAX_KEYS / 2) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }
  if (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** IP klien dari header standar di belakang proxy (Vercel/CDN). */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
