import { NextResponse } from 'next/server';
import { getStorePerformance } from '@/lib/server/reports';
import { handler } from '@/lib/server/http';
import { isResponse, requireWorkspace } from '@/lib/server/workspace';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? undefined;
  // Batas MTD opsional (banner insight) — divalidasi/diklem di server.
  const until = url.searchParams.get('until') ?? undefined;
  return NextResponse.json(await getStorePerformance(month, ctx.workspaceId, until));
});
