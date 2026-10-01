import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, crmClientsTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { CrmClientUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ clientId: string }> };

const scope = (clientId: string, workspaceId: string) =>
  and(eq(crmClientsTable.id, clientId), eq(crmClientsTable.workspaceId, workspaceId));

/** PATCH /api/crm/clients/[clientId] — edit klien milik workspace. */
export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { clientId } = await context.params;
  if (!UUID.test(clientId)) {
    return NextResponse.json({ error: 'clientId tidak valid' }, { status: 400 });
  }

  const parsed = await parseBody(request, CrmClientUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [client] = await db
    .update(crmClientsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(scope(clientId, ctx.workspaceId))
    .returning();
  if (!client) return notFound('Klien tidak ditemukan.');

  return NextResponse.json(client);
});

/** DELETE — hapus klien beserta produk & leads-nya (semua milik workspace). */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { clientId } = await context.params;
  if (!UUID.test(clientId)) {
    return NextResponse.json({ error: 'clientId tidak valid' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(crmClientsTable)
    .where(scope(clientId, ctx.workspaceId))
    .returning();
  if (!deleted) return notFound('Klien tidak ditemukan.');

  return NextResponse.json({ ok: true });
});
