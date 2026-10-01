import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, productsTable, storesTable, suppliersTable } from '@/lib/db';
import { getProductsWithStores } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { requireWorkspace, requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { ProductInput } from '@/lib/server/validation';

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
