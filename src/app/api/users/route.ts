import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, usersTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { getWorkspaceContext } from '@/lib/server/workspace';
import { UserCreateInput } from '@/lib/server/validation';
import type { WorkspaceUserRow } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users — daftar user satu workspace (tanpa hash).
 * Hanya role owner yang boleh memanggil; demo ditolak 403.
 */
export const GET = handler(async () => {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  if (ctx.session.role !== 'owner') {
    return NextResponse.json(
      { error: 'Hanya owner yang boleh melihat daftar pengguna' },
      { status: 403 },
    );
  }

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.workspaceId, ctx.workspaceId))
    .orderBy(asc(usersTable.createdAt), asc(usersTable.email));

  const users: WorkspaceUserRow[] = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
  return NextResponse.json({ users });
});

/**
 * POST /api/users — tambah user ke workspace yang sedang login.
 * workspaceId DIAMBIL DARI SESI (bukan body) supaya owner tidak bisa
 * menyuntikkan user ke tenant lain. Email unik global, jadi bentrok 409.
 */
export const POST = handler(async (request: Request) => {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  if (ctx.session.role !== 'owner') {
    return NextResponse.json(
      { error: 'Hanya owner yang boleh menambah pengguna' },
      { status: 403 },
    );
  }

  const parsed = await parseBody(request, UserCreateInput);
  if (!parsed.success) return badRequest(parsed.error);
  const { email, name, password, role } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(usersTable)
    .values({ email, name, passwordHash, role, workspaceId: ctx.workspaceId })
    .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });

  return NextResponse.json({ user: created }, { status: 201 });
});
