import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, suppliersTable } from '@/lib/db';
import { badRequest, handler, notFound, parsePatch } from '@/lib/server/http';
import { getSupplierProductStats, summarizeSupplierProducts } from '@/lib/server/suppliers';
import { requireWorkspace, requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { SupplierInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ supplierId: string }> };

/**
 * Detail satu suplier + SELURUH produknya (urut omzet menurun).
 *
 * Dipakai halaman /suppliers/[supplierId]: daftar suplier sengaja hanya
 * mengirim ringkasan + beberapa produk teratas, jadi produk lengkap diambil
 * di sini — satu suplier per request, bukan semua suplier sekaligus.
 */
export const GET = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const { supplierId } = await context.params;
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    // Tenant di WHERE: suplier workspace lain → 404, bukan bocor datanya.
    .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.workspaceId, ctx.workspaceId)));

  if (!supplier) return notFound('Suplier tidak ditemukan');

  const products = (await getSupplierProductStats(ctx.workspaceId, supplierId)).get(supplierId) ?? [];

  return NextResponse.json({
    ...supplier,
    ...summarizeSupplierProducts(products),
    products,
  });
});

export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { supplierId } = await context.params;
  const parsed = await parsePatch(request, SupplierInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const [supplier] = await db
    .update(suppliersTable)
    .set(parsed.data)
    // Tenant di WHERE: baris tenant lain tidak bisa dibaca/ubah.
    .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.workspaceId, ctx.workspaceId)))
    .returning();

  if (!supplier) return notFound('Suplier tidak ditemukan');

  // Hanya kolom yang benar-benar berubah. Ringkasan produk sengaja TIDAK ikut:
  // menghitungnya butuh query agregat tambahan di setiap toggle aktif/nonaktif,
  // dan halaman suplier toh meng-invalidate lalu mengambil ulang daftar/detail.
  return NextResponse.json({ ...supplier });
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { supplierId } = await context.params;
  const [supplier] = await db
    .delete(suppliersTable)
    .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.workspaceId, ctx.workspaceId)))
    .returning({ id: suppliersTable.id });

  if (!supplier) return notFound('Suplier tidak ditemukan');
  return NextResponse.json({ ok: true });
});
