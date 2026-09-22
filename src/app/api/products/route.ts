import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, productsTable, storesTable, suppliersTable } from '@/lib/db';
import { getProductsWithStores } from '@/lib/server/dashboard';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { ProductInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const activeOnly = params.get('activeOnly') === 'true';
  const storeId = params.get('storeId');

  return NextResponse.json(await getProductsWithStores(activeOnly, storeId));
});

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, ProductInput);
  if (!parsed.success) return badRequest(parsed.error);

  const supplier = parsed.data.supplierId
    ? (
        await db
          .select({ name: suppliersTable.name, whatsapp: suppliersTable.whatsapp })
          .from(suppliersTable)
          .where(eq(suppliersTable.id, parsed.data.supplierId))
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

  const [store] = await db
    .select({ name: storesTable.name })
    .from(storesTable)
    .where(eq(storesTable.id, product.storeId));

  return NextResponse.json(
    {
      ...product,
      storeName: store?.name ?? 'Toko',
      targetMargin: product.targetMargin == null ? null : Number(product.targetMargin),
    },
    { status: 201 },
  );
});
