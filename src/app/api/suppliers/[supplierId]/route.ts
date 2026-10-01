import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, suppliersTable } from '@/lib/db';
import { badRequest, handler, notFound, parsePatch } from '@/lib/server/http';
import { requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { SupplierInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ supplierId: string }> };

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
  return NextResponse.json({ ...supplier, products: [] });
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
