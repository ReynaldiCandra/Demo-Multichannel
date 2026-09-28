import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db, crmClientsTable, crmProductsTable } from '@/lib/db';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { CrmProductInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/products?clientId=... — daftar produk iklan per klien.
 * Tanpa clientId: semua produk (dengan nama klien) untuk dropdown.
 */
export const GET = handler(async (request: Request) => {
  const clientId = new URL(request.url).searchParams.get('clientId');

  const rows = await db
    .select({
      id: crmProductsTable.id,
      clientId: crmProductsTable.clientId,
      clientName: crmClientsTable.name,
      name: crmProductsTable.name,
      price: crmProductsTable.price,
      notes: crmProductsTable.notes,
    })
    .from(crmProductsTable)
    .innerJoin(crmClientsTable, eq(crmProductsTable.clientId, crmClientsTable.id))
    .where(clientId ? eq(crmProductsTable.clientId, clientId) : undefined)
    .orderBy(asc(crmProductsTable.name));

  return NextResponse.json(rows);
});

/** POST /api/crm/products — buat produk iklan milik satu klien. */
export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, CrmProductInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [client] = await db
    .select({ id: crmClientsTable.id })
    .from(crmClientsTable)
    .where(eq(crmClientsTable.id, parsed.data.clientId))
    .limit(1);
  if (!client) {
    return NextResponse.json({ error: 'Klien tidak ditemukan.' }, { status: 400 });
  }

  const [product] = await db
    .insert(crmProductsTable)
    .values({
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      price: parsed.data.price,
      notes: parsed.data.notes,
    })
    .returning();
  return NextResponse.json(product, { status: 201 });
});
