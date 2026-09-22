import { NextResponse } from 'next/server';
import { getLedgerRows } from '@/lib/server/dashboard';
import { handler } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => NextResponse.json(await getLedgerRows()));
