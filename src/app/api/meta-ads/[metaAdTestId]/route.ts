import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, metaAdTestsTable } from '@/lib/db';
import { dateOnly, todayJakarta } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parsePatch } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { MetaAdTestInput } from '@/lib/server/validation';
import { serializeMetaAdTest } from '@/lib/server/serializers';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ metaAdTestId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { metaAdTestId } = await context.params;
  const parsed = await parsePatch(request, MetaAdTestInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const { startDate, endDate, ...rest } = parsed.data;
  const [test] = await db
    .update(metaAdTestsTable)
    .set({
      ...rest,
      ...(startDate ? { startDate: dateOnly(startDate)! } : {}),
      ...(endDate === undefined ? {} : { endDate: dateOnly(endDate) }),
      lastUpdated: todayJakarta(),
    })
    .where(and(eq(metaAdTestsTable.id, metaAdTestId), eq(metaAdTestsTable.workspaceId, ctx.workspaceId)))
    .returning();

  if (!test) return notFound('Tes Meta Ads tidak ditemukan');
  return NextResponse.json(serializeMetaAdTest(test));
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { metaAdTestId } = await context.params;
  const [test] = await db
    .delete(metaAdTestsTable)
    .where(and(eq(metaAdTestsTable.id, metaAdTestId), eq(metaAdTestsTable.workspaceId, ctx.workspaceId)))
    .returning({ id: metaAdTestsTable.id });

  if (!test) return notFound('Tes Meta Ads tidak ditemukan');
  return NextResponse.json({ ok: true });
});
