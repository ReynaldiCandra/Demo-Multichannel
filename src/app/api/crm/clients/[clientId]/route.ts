import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, crmClientsTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody, requireWriteAccess } from '@/lib/server/http';
import { CrmClientUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ clientId: string }> };

/** PATCH /api/crm/clients/[clientId] — edit klien. */
export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { clientId } = await context.params;
  if (!UUID.test(clientId)) {
    return NextResponse.json({ error: 'clientId tidak valid' }, { status: 400 });
  }

  const parsed = await parseBody(request, CrmClientUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [client] = await db
    .update(crmClientsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(crmClientsTable.id, clientId))
    .returning();
  if (!client) return notFound('Klien tidak ditemukan.');

  return NextResponse.json(client);
});

/** DELETE /api/crm/clients/[clientId] — hapus klien (produk & leads ikut terhapus). */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { clientId } = await context.params;
  if (!UUID.test(clientId)) {
    return NextResponse.json({ error: 'clientId tidak valid' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(crmClientsTable)
    .where(eq(crmClientsTable.id, clientId))
    .returning();
  if (!deleted) return notFound('Klien tidak ditemukan.');

  return NextResponse.json({ ok: true });
});
