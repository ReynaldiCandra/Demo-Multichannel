import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, usersTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { createSessionToken, setSessionCookie, type Role } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

const LoginInput = z.object({
  email: z.string().min(1, 'Email wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const POST = handler(async (request: Request) => {
  const parsed = await parseBody(request, LoginInput);
  if (!parsed.success) return badRequest(parsed.error);

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  // Pesan sengaja dibuat sama untuk email salah maupun password salah, supaya
  // tidak bisa dipakai menebak email mana yang terdaftar.
  const invalid = () =>
    NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });

  if (!user || !user.isActive) {
    // Tetap jalankan hash dummy supaya waktu respons tidak membocorkan apa pun.
    await bcrypt.compare(parsed.data.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
    return invalid();
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return invalid();

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: (user.role === 'demo' ? 'demo' : 'owner') as Role,
  };

  await setSessionCookie(await createSessionToken(sessionUser));
  return NextResponse.json({ user: sessionUser });
});
