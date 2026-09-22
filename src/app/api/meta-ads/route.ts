import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db, metaAdTestsTable } from '@/lib/db';
import { dateOnly, todayJakarta } from '@/lib/server/dashboard';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { MetaAdTestInput } from '@/lib/server/validation';
import { serializeMetaAdTest } from '@/lib/server/serializers';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const status = new URL(request.url).searchParams.get('status');
  const rows = await db
    .select()
    .from(metaAdTestsTable)
    .where(status ? eq(metaAdTestsTable.status, status) : undefined)
    .orderBy(desc(metaAdTestsTable.lastUpdated));

  return NextResponse.json(rows.map(serializeMetaAdTest));
});

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, MetaAdTestInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [test] = await db
    .insert(metaAdTestsTable)
    .values({
      ...parsed.data,
      startDate: dateOnly(parsed.data.startDate)!,
      endDate: dateOnly(parsed.data.endDate),
      lastUpdated: todayJakarta(),
    })
    .returning();

  return NextResponse.json(serializeMetaAdTest(test), { status: 201 });
});
