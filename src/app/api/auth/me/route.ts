import { NextResponse } from 'next/server';
import { handler } from '@/lib/server/http';
import { getSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  return NextResponse.json({ user: session });
});
