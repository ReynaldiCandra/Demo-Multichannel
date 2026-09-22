import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db, modulesTable } from '@/lib/db';
import { badRequest, conflict, handler, notFound, parseBody, requireWriteAccess } from '@/lib/server/http';
import { ModuleUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const modules = await db
    .select()
    .from(modulesTable)
    .orderBy(asc(modulesTable.sortOrder), asc(modulesTable.key));

  return NextResponse.json(modules);
});

export const PATCH = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'Key modul wajib diisi' }, { status: 400 });

  const parsed = await parseBody(request, ModuleUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [current] = await db.select().from(modulesTable).where(eq(modulesTable.key, key));
  if (!current) return notFound('Modul tidak ditemukan');
  if (current.isCore && !parsed.data.isEnabled) {
    return conflict('Modul inti tidak bisa dimatikan.');
  }

  const [module] = await db
    .update(modulesTable)
    .set({ isEnabled: parsed.data.isEnabled })
    .where(eq(modulesTable.key, key))
    .returning();

  return NextResponse.json(module);
});