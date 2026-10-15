import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, productsTable, storesTable, suppliersTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import {
  SUPPLIER_TOP_PRODUCTS,
  getSupplierProductStats,
  summarizeSupplierProducts,
} from '@/lib/server/suppliers';
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

  // Satu suplier bisa punya puluhan produk: daftar hanya mengirim ringkasan +
  // beberapa produk terlaris. Seluruh produk satu suplier diambil lewat
  // GET /api/suppliers/[supplierId].
  const productsBySupplier = await getSupplierProductStats(ctx.workspaceId);

  return NextResponse.json(
    supplierRows.map((supplier) => {
      const products = productsBySupplier.get(supplier.id) ?? [];
      return {
        ...supplier,
        ...summarizeSupplierProducts(products),
        products: products.slice(0, SUPPLIER_TOP_PRODUCTS),
      };
    }),
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

  // Suplier baru belum punya produk, jadi ringkasannya nol — bentuknya tetap
  // sama dengan response GET supaya pemanggil tidak perlu tahu bedanya.
  return NextResponse.json(
    {
      ...supplier,
      productCount: 0,
      totalSold: 0,
      transactionCount: 0,
      revenue: 0,
      products: [],
    },
    { status: 201 },
  );
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
