import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db, metaAdTestsTable } from '@/lib/db';
import { dateOnly, todayJakarta } from '@/lib/server/dashboard';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { MetaAdTestInput } from '@/lib/server/validation';
import { serializeMetaAdTest } from '@/lib/server/serializers';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const status = new URL(request.url).searchParams.get('status');
  const rows = await db
    .select()
    .from(metaAdTestsTable)
    .where(
      status
        ? and(eq(metaAdTestsTable.workspaceId, ctx.workspaceId), eq(metaAdTestsTable.status, status))
        : eq(metaAdTestsTable.workspaceId, ctx.workspaceId),
    )
    .orderBy(desc(metaAdTestsTable.lastUpdated));

  return NextResponse.json(rows.map(serializeMetaAdTest));
});

export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, MetaAdTestInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [test] = await db
    .insert(metaAdTestsTable)
    .values({
      ...parsed.data,
      workspaceId: ctx.workspaceId,
      startDate: dateOnly(parsed.data.startDate)!,
      endDate: dateOnly(parsed.data.endDate),
      lastUpdated: todayJakarta(),
    })
    .returning();

  return NextResponse.json(serializeMetaAdTest(test), { status: 201 });
});
