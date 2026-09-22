import { NextResponse } from 'next/server';
import { count, eq } from 'drizzle-orm';
import { db, hostsTable, liveSessionsTable } from '@/lib/db';
import { badRequest, conflict, handler, notFound, parsePatch, requireWriteAccess } from '@/lib/server/http';
import { HostInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ hostId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { hostId } = await context.params;
  const parsed = await parsePatch(request, HostInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const [host] = await db
    .update(hostsTable)
    .set(parsed.data)
    .where(eq(hostsTable.id, hostId))
    .returning();

  if (!host) return notFound('Host tidak ditemukan');
  return NextResponse.json(host);
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { hostId } = await context.params;
  const [{ total }] = await db
    .select({ total: count() })
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.hostId, hostId));

  if (total > 0) {
    return conflict('Host sudah memiliki riwayat sesi. Nonaktifkan host agar riwayat tetap aman.');
  }

  const [host] = await db
    .delete(hostsTable)
    .where(eq(hostsTable.id, hostId))
    .returning({ id: hostsTable.id });

  if (!host) return notFound('Host tidak ditemukan');
  return NextResponse.json({ ok: true });
});