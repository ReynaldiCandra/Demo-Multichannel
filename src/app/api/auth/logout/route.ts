import { NextResponse } from 'next/server';
import { handler } from '@/lib/server/http';
import { clearSessionCookie } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export const POST = handler(async () => {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
