import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, hostsTable, liveSessionsTable, storesTable } from '@/lib/db';
import { dateOnly } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parsePatch, requireWriteAccess } from '@/lib/server/http';
import { LiveSessionInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ liveSessionId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { liveSessionId } = await context.params;
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
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { liveSessionId } = await context.params;
  const [session] = await db
    .delete(liveSessionsTable)
    .where(eq(liveSessionsTable.id, liveSessionId))
    .returning({ id: liveSessionsTable.id });

  if (!session) return notFound('Sesi live tidak ditemukan');
  return NextResponse.json({ ok: true });
});
