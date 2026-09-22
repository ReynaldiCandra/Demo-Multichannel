import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable } from '@/lib/db';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { StoreInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  return NextResponse.json(
    await db
      .select({
        id: storesTable.id,
        name: storesTable.name,
        channel: storesTable.channel,
        isActive: storesTable.isActive,
        feePercent: storesTable.feePercent,
        productCount: sql<string>`count(distinct ${productsTable.id})`,
        transactionCount: sql<string>`count(distinct ${salesTable.id})`,
      })
      .from(storesTable)
      .leftJoin(productsTable, eq(productsTable.storeId, storesTable.id))
      .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
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
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, StoreInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [store] = await db
    .insert(storesTable)
    .values({ ...parsed.data, feePercent: String(parsed.data.feePercent) })
    .returning();
  return NextResponse.json(
    { ...store, feePercent: Number(store.feePercent) || 0, productCount: 0, transactionCount: 0 },
    { status: 201 },
  );
});
