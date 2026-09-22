import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, metaAdTestsTable } from '@/lib/db';
import { dateOnly, todayJakarta } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parsePatch, requireWriteAccess } from '@/lib/server/http';
import { MetaAdTestInput } from '@/lib/server/validation';
import { serializeMetaAdTest } from '@/lib/server/serializers';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ metaAdTestId: string }> };

export const PATCH = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

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
    .where(eq(metaAdTestsTable.id, metaAdTestId))
    .returning();

  if (!test) return notFound('Tes Meta Ads tidak ditemukan');
  return NextResponse.json(serializeMetaAdTest(test));
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { metaAdTestId } = await context.params;
  const [test] = await db
    .delete(metaAdTestsTable)
    .where(eq(metaAdTestsTable.id, metaAdTestId))
    .returning({ id: metaAdTestsTable.id });

  if (!test) return notFound('Tes Meta Ads tidak ditemukan');
  return NextResponse.json({ ok: true });
});
