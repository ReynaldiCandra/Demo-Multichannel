import { NextResponse } from 'next/server';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, hostsTable, liveSessionsTable, storesTable } from '@/lib/db';
import { dateOnly, periodBounds } from '@/lib/server/dashboard';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { LiveSessionInput, PERIOD_PATTERN } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/live-sessions?period=...
 *   period "YYYY-Www" (minggu ISO) | "YYYY-MM" (bulan) | "YYYY" (tahun)
 *   Tanpa period: bulan berjalan (perilaku lama tetap aman).
 */
export const GET = handler(async (request: Request) => {
  const raw = new URL(request.url).searchParams.get('period');
  const period = raw && PERIOD_PATTERN.test(raw) ? raw : null;
  const bounds = period ? periodBounds(period) : null;

  const rows = await db
    .select({
      session: liveSessionsTable,
      hostName: hostsTable.name,
      hostImage: hostsTable.imageUrl,
      storeName: storesTable.name,
    })
    .from(liveSessionsTable)
    .innerJoin(hostsTable, eq(liveSessionsTable.hostId, hostsTable.id))
    .innerJoin(storesTable, eq(liveSessionsTable.storeId, storesTable.id))
    .where(bounds ? and(gte(liveSessionsTable.sessionDate, bounds.start), lt(liveSessionsTable.sessionDate, bounds.end)) : undefined)
    .orderBy(desc(liveSessionsTable.sessionDate));

  return NextResponse.json(
    rows.map(({ session, hostName, hostImage, storeName }) => ({
      id: session.id,
      hostId: session.hostId,
      hostName,
      hostImage,
      storeId: session.storeId,
      storeName,
      date: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      totalOrders: session.totalOrders,
      totalRevenue: session.totalRevenue,
      totalComments: session.totalComments,
      commissionAmount: session.commissionAmount,
      commissionPaid: session.commissionPaid,
      notes: session.notes,
    })),
  );
});

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, LiveSessionInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [session] = await db
    .insert(liveSessionsTable)
    .values({
      hostId: parsed.data.hostId,
      storeId: parsed.data.storeId,
      sessionDate: dateOnly(parsed.data.date)!,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      totalOrders: parsed.data.totalOrders,
      totalRevenue: parsed.data.totalRevenue,
      totalComments: parsed.data.totalComments,
      commissionAmount: parsed.data.commissionAmount,
      commissionPaid: parsed.data.commissionPaid,
      notes: parsed.data.notes,
    })
    .returning();

  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, session.hostId));
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, session.storeId));

  return NextResponse.json(
    {
      ...session,
      hostName: host?.name ?? 'Host',
      hostImage: host?.imageUrl ?? null,
      storeName: store?.name ?? 'Toko',
      date: session.sessionDate,
    },
    { status: 201 },
  );
});
