import { NextResponse } from 'next/server';
import { getLedgerRows } from '@/lib/server/dashboard';
import { handler } from '@/lib/server/http';
import { isResponse, requireWorkspace } from '@/lib/server/workspace';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  return NextResponse.json(await getLedgerRows(undefined, ctx.workspaceId));
});
