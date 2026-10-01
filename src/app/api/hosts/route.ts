import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db, hostsTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { HostInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const rows = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.workspaceId, ctx.workspaceId))
    .orderBy(asc(hostsTable.name));

  return NextResponse.json(rows);
});

export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, HostInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [host] = await db
    .insert(hostsTable)
    .values({ ...parsed.data, workspaceId: ctx.workspaceId })
    .returning();

  return NextResponse.json(host, { status: 201 });
});
