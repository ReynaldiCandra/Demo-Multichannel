import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, usersTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { clientIp, rateLimit } from '@/lib/server/rate-limit';
import { createSessionToken, setSessionCookie, type Role } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

const LoginInput = z.object({
  email: z.string().min(1, 'Email wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// Hardening pra-beta: perlambat brute-force. Per-email melindungi satu akun
// dari serangan terarah; per-IP membatasi penyebaran ke banyak akun.
const MAX_PER_EMAIL = 10;
const MAX_PER_IP = 30;
const WINDOW_MS = 10 * 60_000; // 10 menit

export const POST = handler(async (request: Request) => {
  const parsed = await parseBody(request, LoginInput);
  if (!parsed.success) return badRequest(parsed.error);

  const email = parsed.data.email.trim().toLowerCase();
  const ip = clientIp(request);

  // Cek limit SEBELUM sentuh DB — dan tetap catat kegagalan berikutnya
  // supaya penyerang tidak bisa mengaburkan hitungan dengan body sampah.
  const perEmail = rateLimit(`login:email:${email}`, MAX_PER_EMAIL, WINDOW_MS);
  const perIp = rateLimit(`login:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (!perEmail.ok || !perIp.ok) {
    const retry = Math.max(perEmail.ok ? 0 : perEmail.retryAfterSeconds, perIp.ok ? 0 : perIp.retryAfterSeconds);
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    );
  }

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
    // Tenant disertakan di token supaya fase 3 bisa scoping query per workspace.
    workspaceId: user.workspaceId ?? undefined,
  };

  await setSessionCookie(await createSessionToken(sessionUser));
  return NextResponse.json({ user: sessionUser });
});
