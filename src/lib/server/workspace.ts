import 'server-only';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, usersTable } from '@/lib/db';
import { getSession, type SessionUser } from './session';

export type WorkspaceContext = { session: SessionUser; workspaceId: string };

/**
 * Sesi + tenant aktif. Fase 3 multi-tenant: SEMUA query data bisnis wajib
 * memakai `workspaceId` dari sini — jangan pernah dari body/URL request.
 *
 * Token lama (sebelum fase 1) tidak membawa claim workspaceId; fallback
 * membaca ulang dari DB supaya pengguna yang masih login tidak dipaksa
 * logout saat deploy. Token baru selalu membawa claim-nya.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.workspaceId) return { session, workspaceId: session.workspaceId };

  const [user] = await db
    .select({ workspaceId: usersTable.workspaceId })
    .from(usersTable)
    .where(eq(usersTable.id, session.id));

  if (!user?.workspaceId) return null; // default-deny: tanpa tenant tidak ada data
  return { session: { ...session, workspaceId: user.workspaceId }, workspaceId: user.workspaceId };
}

/**
 * Guard untuk endpoint BACA. Return context, atau Response 401 kalau belum
 * login / tidak punya workspace.
 */
export async function requireWorkspace(): Promise<WorkspaceContext | NextResponse> {
  const context = await getWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  return context;
}

/**
 * Guard untuk endpoint TULIS: gabungan requireWorkspace + penolakan akun demo.
 * Return context, atau Response (401 belum login / 403 mode demo).
 */
export async function requireWorkspaceWrite(): Promise<WorkspaceContext | NextResponse> {
  const context = await getWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  if (context.session.role === 'demo') {
    return NextResponse.json(
      { error: 'Mode demo hanya bisa melihat data, tidak bisa mengubah.' },
      { status: 403 },
    );
  }
  return context;
}

/** Narower: context atau Response dari guard di atas. */
export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}
