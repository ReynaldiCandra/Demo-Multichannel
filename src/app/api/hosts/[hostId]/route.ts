import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { db, hostsTable, liveSessionsTable } from '@/lib/db';
import { badRequest, conflict, handler, notFound, parsePatch } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { HostInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ hostId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { hostId } = await context.params;
  const parsed = await parsePatch(request, HostInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const [host] = await db
    .update(hostsTable)
    .set(parsed.data)
    .where(and(eq(hostsTable.id, hostId), eq(hostsTable.workspaceId, ctx.workspaceId)))
    .returning();

  if (!host) return notFound('Host tidak ditemukan');
  return NextResponse.json(host);
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { hostId } = await context.params;
  // live_sessions adalah tabel anak (tanpa workspace_id) — cukup hitung via
  // hostId; host-nya sendiri sudah diverifikasi milik workspace di bawah.
  const [{ total }] = await db
    .select({ total: count() })
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.hostId, hostId));

  if (total > 0) {
    return conflict('Host sudah memiliki riwayat sesi. Nonaktifkan host agar riwayat tetap aman.');
  }

  const [host] = await db
    .delete(hostsTable)
    .where(and(eq(hostsTable.id, hostId), eq(hostsTable.workspaceId, ctx.workspaceId)))
    .returning({ id: hostsTable.id });

  if (!host) return notFound('Host tidak ditemukan');
  return NextResponse.json({ ok: true });
});
