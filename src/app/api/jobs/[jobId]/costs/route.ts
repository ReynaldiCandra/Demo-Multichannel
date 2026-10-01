import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, jobCostsTable, jobsTable } from '@/lib/db';
import { dateOnly } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { JobCostInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ jobId: string }> };

export const POST = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { jobId } = await context.params;
  const parsed = await parseBody(request, JobCostInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!job) return notFound('Job tidak ditemukan');

  const [cost] = await db
    .insert(jobCostsTable)
    .values({
      jobId,
      costDate: dateOnly(parsed.data.date)!,
      description: parsed.data.description,
      amount: parsed.data.amount,
    })
    .returning();

  return NextResponse.json(
    {
      id: cost.id,
      jobId: cost.jobId,
      date: cost.costDate,
      description: cost.description,
      amount: cost.amount,
    },
    { status: 201 },
  );
});
