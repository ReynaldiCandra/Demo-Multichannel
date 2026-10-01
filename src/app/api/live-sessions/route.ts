import { NextResponse } from 'next/server';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, hostsTable, liveSessionsTable, storesTable } from '@/lib/db';
import { dateOnly, periodBounds } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { LiveSessionInput, PERIOD_PATTERN } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/live-sessions?period=...
 *   period "YYYY-Www" (minggu ISO) | "YYYY-MM" (bulan) | "YYYY" (tahun)
 *   Tanpa period: bulan berjalan (perilaku lama tetap aman).
 * Tenant: live_sessions adalah tabel anak — di-scope via host pemiliknya.
 */
export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

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
    .where(
      and(
        eq(hostsTable.workspaceId, ctx.workspaceId),
        bounds
          ? and(gte(liveSessionsTable.sessionDate, bounds.start), lt(liveSessionsTable.sessionDate, bounds.end))
          : undefined,
      ),
    )
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
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, LiveSessionInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Host & toko wajib milik workspace yang sama (tabel root, kolom workspace_id).
  const [host] = await db
    .select()
    .from(hostsTable)
    .where(and(eq(hostsTable.id, parsed.data.hostId), eq(hostsTable.workspaceId, ctx.workspaceId)))
    .limit(1);
  const [store] = await db
    .select()
    .from(storesTable)
    .where(and(eq(storesTable.id, parsed.data.storeId), eq(storesTable.workspaceId, ctx.workspaceId)))
    .limit(1);

  if (!host || !store) return notFound('Host atau toko tidak ditemukan');

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

  return NextResponse.json(
    {
      ...session,
      hostName: host.name,
      hostImage: host.imageUrl ?? null,
      storeName: store.name,
      date: session.sessionDate,
    },
    { status: 201 },
  );
});
