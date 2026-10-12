import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, usersTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { getSession } from '@/lib/server/session';
import { ChangePasswordInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/change-password
 *
 * Ganti password AKUN SENDIRI. Password lama wajib benar — endpoint ini tidak
 * bisa dipakai mengganti password user lain, jadi aman untuk role demo pun
 * (demo boleh mengganti password miliknya sendiri).
 *
 * Semua token sesi (termasuk perangkat lain) tetap berlaku setelah ganti
 * password; kalau nanti perlu "logout semua perangkat", tambahkan kolom
 * `token_version` di users lalu naikkan di sini.
 */
export const POST = handler(async (request: Request) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Belum login' }, { status: 401 });

  const parsed = await parseBody(request, ChangePasswordInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [user] = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, session.id));

  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Password lama salah' }, { status: 400 });
  }

  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: 'Password baru harus berbeda dari password lama' },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, session.id));

  return NextResponse.json({ ok: true });
});
