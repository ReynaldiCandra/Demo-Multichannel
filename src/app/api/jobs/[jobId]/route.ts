import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, jobsTable } from '@/lib/db';
import { dateOnly, getJobFinancials, serializeJob } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parsePatch } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { JobInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ jobId: string }> };

export const GET = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const { jobId } = await context.params;
  // Dua argumen: id + workspace — job tenant lain tidak akan cocok (→ 404).
  const [financial] = await getJobFinancials(jobId, ctx.workspaceId);
  if (!financial) return notFound('Job tidak ditemukan');

  return NextResponse.json({
    ...serializeJob(financial),
    costs: financial.costs.map((cost) => ({
      id: cost.id,
      jobId: cost.jobId,
      date: cost.costDate,
      description: cost.description,
      amount: cost.amount,
    })),
    payments: financial.payments.map((payment) => ({
      id: payment.id,
      jobId: payment.jobId,
      date: payment.paymentDate,
      amount: payment.amount,
      type: payment.type,
    })),
  });
});

export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { jobId } = await context.params;
  const parsed = await parsePatch(request, JobInput.partial());
  if (!parsed.success) return badRequest(parsed.error);

  const { startDate, deadline, ...rest } = parsed.data;
  const [job] = await db
    .update(jobsTable)
    .set({
      ...rest,
      ...(startDate ? { startDate: dateOnly(startDate)! } : {}),
      ...(deadline === undefined ? {} : { deadline: dateOnly(deadline) }),
    })
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.workspaceId, ctx.workspaceId)))
    .returning();

  if (!job) return notFound('Job tidak ditemukan');

  const [financial] = await getJobFinancials(job.id, ctx.workspaceId);
  if (!financial) return notFound('Job tidak ditemukan');

  return NextResponse.json(serializeJob(financial));
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { jobId } = await context.params;
  const [job] = await db
    .delete(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.workspaceId, ctx.workspaceId)))
    .returning({ id: jobsTable.id });

  if (!job) return notFound('Job tidak ditemukan');
  return NextResponse.json({ ok: true });
});
