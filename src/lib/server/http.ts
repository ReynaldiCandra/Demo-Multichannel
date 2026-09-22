import { NextResponse } from 'next/server';
import type { z, ZodError, ZodType } from 'zod';

export function badRequest(error: ZodError) {
  return NextResponse.json(
    { error: 'Data tidak valid', issues: error.issues },
    { status: 400 },
  );
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(error: unknown) {
  console.error(error);
  return NextResponse.json(
    { error: 'Terjadi kesalahan di server. Periksa konfigurasi dan log terminal.' },
    { status: 500 },
  );
}

/** Wraps a route handler so an unexpected throw becomes a 500 JSON body. */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      return serverError(error);
    }
  };
}

export async function parseBody<S extends ZodType>(request: Request, schema: S) {
  const raw = await request.json().catch(() => ({}));
  return schema.safeParse(raw);
}

/**
 * Parses a PATCH body and keeps ONLY the keys the caller actually sent.
 *
 * Zod still applies `.default()` and transforms to absent keys even on a
 * `.partial()` schema, so a partial update would otherwise silently reset every
 * field the client left out (modal -> 0, commissionAmount -> 0, and so on).
 */
export async function parsePatch<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<
  { success: true; data: Partial<z.infer<S>> } | { success: false; error: ZodError }
> {
  const raw: unknown = await request.json().catch(() => ({}));
  const result = schema.safeParse(raw);
  if (!result.success) return { success: false, error: result.error };

  const sentKeys = new Set(
    raw && typeof raw === 'object' ? Object.keys(raw as Record<string, unknown>) : [],
  );
  const data = Object.fromEntries(
    Object.entries(result.data as Record<string, unknown>).filter(([key]) =>
      sentKeys.has(key),
    ),
  );

  return { success: true, data: data as Partial<z.infer<S>> };
}

/**
 * Guard untuk semua endpoint yang menulis data.
 *
 * Akun demo boleh melihat apa saja tapi tidak boleh mengubah apa pun. Penolakan
 * dilakukan di server, bukan cuma menyembunyikan tombol di UI, supaya tidak
 * bisa diakali lewat curl atau devtools.
 */
export async function requireWriteAccess(): Promise<Response | null> {
  const { getSession } = await import('./session');
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }

  if (session.role === 'demo') {
    return NextResponse.json(
      { error: 'Mode demo hanya bisa melihat data, tidak bisa mengubah.' },
      { status: 403 },
    );
  }

  return null;
}
