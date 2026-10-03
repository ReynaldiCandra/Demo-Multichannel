import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, productsTable, salesTable, storesTable, suppliersTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { requireWorkspace, requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { BulkActiveInput, BulkIdsInput, SupplierInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;
  // Jangan menggabungkan object supplier dengan GROUP BY agregasi produk.
  // PostgreSQL dapat menolak query itu (atau mengembalikan error saat schema
  // supplier berubah), sehingga halaman daftar supplier terlihat "tidak bisa dimuat".
  const supplierRows = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.workspaceId, ctx.workspaceId))
    .orderBy(asc(suppliersTable.name));

  const productRows = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      imageUrl: productsTable.imageUrl,
      supplierId: productsTable.supplierId,
      totalSold: sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} else 0 end), 0)`,
      transactionCount: sql<string>`count(case when ${salesTable.status} = 'selesai' then ${salesTable.id} end)`,
      revenue: sql<string>`coalesce(sum(case when ${salesTable.status} = 'selesai' then ${salesTable.qty} * ${salesTable.actualPrice} - ${salesTable.discount} else 0 end), 0)`,
    })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .leftJoin(salesTable, eq(salesTable.productId, productsTable.id))
    .where(
      and(
        sql`${productsTable.supplierId} is not null`,
        // Tenant: hanya produk milik workspace ini.
        eq(storesTable.workspaceId, ctx.workspaceId),
      ),
    )
    .groupBy(productsTable.id)
    .orderBy(asc(productsTable.name));

  const productsBySupplier = new Map<string, Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    totalSold: number;
    transactionCount: number;
    revenue: number;
  }>>();

  for (const row of productRows) {
    if (!row.supplierId || !row.productName || !row.productId) continue;
    const current = productsBySupplier.get(row.supplierId) ?? [];
    if (row.productId && row.productName) {
      current.push({
        id: row.productId,
        name: row.productName,
        imageUrl: row.imageUrl,
        totalSold: Number(row.totalSold) || 0,
        transactionCount: Number(row.transactionCount) || 0,
        revenue: Number(row.revenue) || 0,
      });
    }
    productsBySupplier.set(row.supplierId, current);
  }

  return NextResponse.json(
    supplierRows.map((supplier) => ({
      ...supplier,
      products: productsBySupplier.get(supplier.id) ?? [],
    })),
  );
});

export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, SupplierInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [supplier] = await db
    .insert(suppliersTable)
    .values({ ...parsed.data, workspaceId: ctx.workspaceId })
    .returning();
  return NextResponse.json({ ...supplier, products: [] }, { status: 201 });
});

/** POST /api/suppliers/bulk-delete — hapus massal suplier milik workspace. */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkIdsInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Suplier yang masih punya produk tidak boleh ikut terhapus — produk lain
  // masih merujuknya (products.supplier_id on delete set null mengosongkan
  // referensi, tapi data suplier itu tetap dibutuhkan di daftar produk).
  const inUse = await db
    .select({ supplierId: productsTable.supplierId })
    .from(productsTable)
    .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
    .where(
      and(
        inArray(productsTable.supplierId, parsed.data.ids),
        eq(storesTable.workspaceId, ctx.workspaceId),
      ),
    );
  const usedIds = new Set(inUse.map((row) => row.supplierId));

  const deletable = parsed.data.ids.filter((id) => !usedIds.has(id));
  // returning() supaya yang dilaporkan hanya yang benar-benar terhapus —
  // ID milik workspace lain otomatis gugur di WHERE workspace_id.
  const deleted = deletable.length
    ? await db
        .delete(suppliersTable)
        .where(
          and(
            inArray(suppliersTable.id, deletable),
            eq(suppliersTable.workspaceId, ctx.workspaceId),
          ),
        )
        .returning({ id: suppliersTable.id })
    : [];

  return NextResponse.json({
    ok: true,
    deleted: deleted.map((row) => row.id),
    skipped: parsed.data.ids.filter((id) => usedIds.has(id)),
  });
});

/** PATCH /api/suppliers — aktif/nonaktif massal. */
export const PATCH = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, BulkActiveInput);
  if (!parsed.success) return badRequest(parsed.error);

  const updated = await db
    .update(suppliersTable)
    .set({ isActive: parsed.data.isActive })
    .where(
      and(
        inArray(suppliersTable.id, parsed.data.ids),
        eq(suppliersTable.workspaceId, ctx.workspaceId),
      ),
    )
    .returning({ id: suppliersTable.id });

  return NextResponse.json({ ok: true, updated: updated.map((row) => row.id) });
});
