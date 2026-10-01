import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, hostsTable, liveSessionsTable, storesTable } from '@/lib/db';
import { dateOnly } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parsePatch } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { LiveSessionInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ liveSessionId: string }> };

/**
 * Sesi milik workspace ini? live_sessions adalah tabel anak — keanggotaan
 * tenant diverifikasi via host pemiliknya.
 */
async function findScopedSession(liveSessionId: string, workspaceId: string) {
  const [row] = await db
    .select({ session: liveSessionsTable })
    .from(liveSessionsTable)
    .innerJoin(hostsTable, eq(liveSessionsTable.hostId, hostsTable.id))
    .where(
      and(eq(liveSessionsTable.id, liveSessionId), eq(hostsTable.workspaceId, workspaceId)),
    )
    .limit(1);
  return row?.session ?? null;
}

export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { liveSessionId } = await context.params;
  const existing = await findScopedSession(liveSessionId, ctx.workspaceId);
  if (!existing) return notFound('Sesi live tidak ditemukan');

  const parsed = await parsePatch(request, LiveSessionInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const { date, ...rest } = parsed.data;
  const [session] = await db
    .update(liveSessionsTable)
    .set({
      ...rest,
      ...(date ? { sessionDate: dateOnly(date)! } : {}),
    })
    .where(eq(liveSessionsTable.id, liveSessionId))
    .returning();

  if (!session) return notFound('Sesi live tidak ditemukan');

  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, session.hostId));
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, session.storeId));

  return NextResponse.json({
    ...session,
    hostName: host?.name ?? 'Host',
    storeName: store?.name ?? 'Toko',
    date: session.sessionDate,
  });
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { liveSessionId } = await context.params;
  const existing = await findScopedSession(liveSessionId, ctx.workspaceId);
  if (!existing) return notFound('Sesi live tidak ditemukan');

  await db.delete(liveSessionsTable).where(eq(liveSessionsTable.id, liveSessionId));
  return NextResponse.json({ ok: true });
});
