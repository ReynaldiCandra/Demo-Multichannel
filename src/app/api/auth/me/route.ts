import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { usersTable, db } from '@/lib/db';
import { handler, badRequest } from '@/lib/server/http';
import { MeUpdateInput } from '@/lib/server/validation';
import { getSession, createSessionToken, setSessionCookie } from '@/lib/server/session';
import type { Role } from '@/lib/server/session-edge';

export const dynamic = 'force-dynamic';

/** Profil sesi aktif: klaim token + kolom freshest (imageUrl) dari DB. */
export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Belum login' }, { status: 401 });

  const [user] = await db
    .select({ imageUrl: usersTable.imageUrl })
    .from(usersTable)
    .where(eq(usersTable.id, session.id));
  if (!user) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });

  return NextResponse.json({ user: { ...session, imageUrl: user.imageUrl } });
});

/** Perbarui nama & foto profil milik sendiri. Demo tidak boleh menulis. */
export const PATCH = handler(async (request: Request) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  if (session.role === 'demo') {
    return NextResponse.json(
      { error: 'Mode demo hanya bisa melihat data, tidak bisa mengubah.' },
      { status: 403 },
    );
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = MeUpdateInput.safeParse(raw);
  if (!parsed.success) return badRequest(parsed.error);

  const [user] = await db
    .update(usersTable)
    .set({
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.imageUrl === undefined ? {} : { imageUrl: parsed.data.imageUrl }),
    })
    .where(eq(usersTable.id, session.id))
    .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role, workspaceId: usersTable.workspaceId, imageUrl: usersTable.imageUrl });

  if (!user) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });

  // Role di DB disimpan sebagai text — dinarrow ke Role supaya klaim JWT
  // selalu salah satu dari enum yang diketahui.
  const role: Role =
    user.role === 'owner' ? 'owner' : user.role === 'pengguna' ? 'pengguna' : 'demo';
  const profile = {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    imageUrl: user.imageUrl,
    workspaceId: user.workspaceId ?? undefined,
  };

  // Terbitkan ulang cookie sesi supaya klaim JWT (nama & foto) ikut terbaru —
  // sidebar tidak menunggu token lama hangus (umurnya 7 hari).
  await setSessionCookie(await createSessionToken(profile));

  return NextResponse.json({ user: profile });
});
