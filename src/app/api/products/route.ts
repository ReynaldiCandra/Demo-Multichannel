import { NextResponse } from 'next/server';
import { and, eq, inArray, count } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable, suppliersTable } from '@/lib/db';
import { getProductsWithStores } from '@/lib/server/dashboard';
import { badRequest, conflict, handler, notFound, parseBody } from '@/lib/server/http';
import { requireWorkspace, requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { BulkActiveInput, BulkIdsInput, ProductInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;
  const params = new URL(request.url).searchParams;
  const activeOnly = params.get('activeOnly') === 'true';
  const storeId = params.get('storeId');

  return NextResponse.json(await getProductsWithStores(activeOnly, storeId, ctx.workspaceId));
});

export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, ProductInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Produk harus menempel ke toko milik workspace sendiri — storeId tenant
  // lain akan 404, bukan diam-diam membuat produk di tenant orang.
  const [store] = await db
    .select({ id: storesTable.id })
    .from(storesTable)
    .where(
      and(eq(storesTable.id, parsed.data.storeId), eq(storesTable.workspaceId, ctx.workspaceId)),
    );
  if (!store) return notFound('Toko tidak ditemukan');

  const supplier = parsed.data.supplierId
    ? (
        await db
          .select({ name: suppliersTable.name, whatsapp: suppliersTable.whatsapp })
          .from(suppliersTable)
          .where(
            and(
              eq(suppliersTable.id, parsed.data.supplierId),
              eq(suppliersTable.workspaceId, ctx.workspaceId),
            ),
          )
      )[0]
    : null;

  const [product] = await db
    .insert(productsTable)
    .values({
      ...parsed.data,
      supplierName: supplier?.name ?? parsed.data.supplierName ?? null,
      supplierPhone: supplier?.whatsapp ?? parsed.data.supplierPhone ?? null,
      targetMargin: parsed.data.targetMargin?.toString() ?? null,
    })
    .returning();

  const [storeInfo] = await db
    .select({ name: storesTable.name })
    .from(storesTable)
    .where(eq(storesTable.id, product.storeId));

  return NextResponse.json(
    {
      ...product,
      storeName: storeInfo?.name ?? 'Toko',
      targetMargin: product.targetMargin == null ? null : Number(product.targetMargin),
    },
    { status: 201 },
  );
});

/** POST /api/products/bulk-delete — hapus massal produk milik workspace. */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkIdsInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Saring ke workspace ini lewat join ke stores (products tidak punya kolom workspace).
  const owned = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(
      and(
        inArray(productsTable.id, parsed.data.ids),
        eq(storesTable.workspaceId, ctx.workspaceId),
      ),
    );
  if (!owned.length) {
    return NextResponse.json({ ok: true, deleted: [], skipped: [] });
  }
  const ownedIds = owned.map((row) => row.id);

  // Produk yang sudah dipakai transaksi tidak boleh hilang, sama seperti hapus satuan.
  const used = await db
    .select({ id: salesTable.productId, total: count() })
    .from(salesTable)
    .where(inArray(salesTable.productId, ownedIds))
    .groupBy(salesTable.productId);
  const usedIds = new Set(used.map((row) => row.id));

  const deletable = ownedIds.filter((id) => !usedIds.has(id));
  if (deletable.length) {
    await db.delete(productsTable).where(inArray(productsTable.id, deletable));
  }

  return NextResponse.json({
    ok: true,
    deleted: deletable,
    // Product yang punya riwayat sale dilaporkan agar UI bisa menampilkan pesannya.
    skipped: ownedIds.filter((id) => usedIds.has(id)),
  });
});

/** PATCH /api/products/bulk-update — ubah status aktif massal. */
export const PATCH = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkActiveInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Saring ke workspace ini lewat join ke stores dulu — UPDATE tidak bisa
  // memakai WHERE lintas tabel langsung.
  const owned = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(
      and(
        inArray(productsTable.id, parsed.data.ids),
        eq(storesTable.workspaceId, ctx.workspaceId),
      ),
    );
  if (!owned.length) {
    return NextResponse.json({ ok: true, updated: [] });
  }

  const updated = await db
    .update(productsTable)
    .set({ isActive: parsed.data.isActive })
    .where(inArray(productsTable.id, owned.map((row) => row.id)))
    .returning({ id: productsTable.id });

  return NextResponse.json({ ok: true, updated: updated.map((row) => row.id) });
});
