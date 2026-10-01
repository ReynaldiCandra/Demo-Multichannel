import { NextResponse } from 'next/server';
import { db, jobsTable } from '@/lib/db';
import { dateOnly, getJobTotals, serializeJob } from '@/lib/server/dashboard';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { JobInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  const attentionOnly = params.get('attentionOnly') === 'true';

  const rows = (await getJobTotals(ctx.workspaceId)).map(serializeJob);
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
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, JobInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [job] = await db
    .insert(jobsTable)
    .values({
      ...parsed.data,
      workspaceId: ctx.workspaceId,
      startDate: dateOnly(parsed.data.startDate)!,
      deadline: dateOnly(parsed.data.deadline),
    })
    .returning();

  return NextResponse.json(
    serializeJob({ job, payments: [], costs: [], totalPaid: 0, totalCost: 0 }),
    { status: 201 },
  );
});
