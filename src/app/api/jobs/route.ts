import { NextResponse } from 'next/server';
import { db, jobsTable } from '@/lib/db';
import { dateOnly, getJobTotals, serializeJob } from '@/lib/server/dashboard';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { JobInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  const attentionOnly = params.get('attentionOnly') === 'true';

  const rows = (await getJobTotals()).map(serializeJob);
  const filtered = rows.filter((row) => {
    const statusMatch = status ? row.status === status : true;
    const attentionMatch = attentionOnly
      ? row.isOverdue || row.paymentStatus !== 'paid'
      : true;
    return statusMatch && attentionMatch;
  });

  return NextResponse.json(filtered);
});

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, JobInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [job] = await db
    .insert(jobsTable)
    .values({
      ...parsed.data,
      startDate: dateOnly(parsed.data.startDate)!,
      deadline: dateOnly(parsed.data.deadline),
    })
    .returning();

  return NextResponse.json(
    serializeJob({ job, payments: [], costs: [], totalPaid: 0, totalCost: 0 }),
    { status: 201 },
  );
});
