import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { requireWorkspace, requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { StoreInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;
  const workspaceId = ctx.workspaceId;

  return NextResponse.json(
    await db
      .select({
        id: storesTable.id,
        name: storesTable.name,
        channel: storesTable.channel,
        isActive: storesTable.isActive,
        imageUrl: storesTable.imageUrl,
        feePercent: storesTable.feePercent,
        productCount: sql<string>`count(distinct ${productsTable.id})`,
        transactionCount: sql<string>`count(distinct ${salesTable.id})`,
      })
      .from(storesTable)
      .leftJoin(productsTable, eq(productsTable.storeId, storesTable.id))
      .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
      .where(eq(storesTable.workspaceId, workspaceId))
      .groupBy(storesTable.id)
      .orderBy(asc(storesTable.name), asc(storesTable.channel))
      .then((stores) =>
        stores.map((store) => ({
          ...store,
          feePercent: Number(store.feePercent) || 0,
          productCount: Number(store.productCount) || 0,
          transactionCount: Number(store.transactionCount) || 0,
        })),
      ),
  );
});

export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, StoreInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Tenant diambil dari sesi, bukan dari body — tidak bisa dipalsukan.
  const [store] = await db
    .insert(storesTable)
    .values({
      ...parsed.data,
      feePercent: String(parsed.data.feePercent),
      workspaceId: ctx.workspaceId,
    })
    .returning();
  return NextResponse.json(
    { ...store, feePercent: Number(store.feePercent) || 0, productCount: 0, transactionCount: 0 },
    { status: 201 },
  );
});
