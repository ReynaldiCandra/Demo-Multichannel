import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, suppliersTable } from '@/lib/db';
import { badRequest, handler, notFound, parsePatch, requireWriteAccess } from '@/lib/server/http';
import { SupplierInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ supplierId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { supplierId } = await context.params;
  const parsed = await parsePatch(request, SupplierInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const [supplier] = await db
    .update(suppliersTable)
    .set(parsed.data)
    .where(eq(suppliersTable.id, supplierId))
    .returning();

  if (!supplier) return notFound('Suplier tidak ditemukan');
  return NextResponse.json({ ...supplier, products: [] });
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { supplierId } = await context.params;
  const [supplier] = await db
    .delete(suppliersTable)
    .where(eq(suppliersTable.id, supplierId))
    .returning({ id: suppliersTable.id });

  if (!supplier) return notFound('Suplier tidak ditemukan');
  return NextResponse.json({ ok: true });
});
