import { NextResponse } from 'next/server';
import { getStorePerformance } from '@/lib/server/reports';
import { handler } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const month = new URL(request.url).searchParams.get('month') ?? undefined;
  return NextResponse.json(await getStorePerformance(month));
});
