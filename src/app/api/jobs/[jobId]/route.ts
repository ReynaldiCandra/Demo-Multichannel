import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, jobsTable } from '@/lib/db';
import { dateOnly, getJobFinancials, serializeJob } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parsePatch, requireWriteAccess } from '@/lib/server/http';
import { JobInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ jobId: string }> };

export const GET = handler(async (_request: Request, context: Context) => {
  const { jobId } = await context.params;
  const [financial] = await getJobFinancials(jobId);
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
  const denied = await requireWriteAccess();
  if (denied) return denied;

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
    .where(eq(jobsTable.id, jobId))
    .returning();

  if (!job) return notFound('Job tidak ditemukan');

  const [financial] = await getJobFinancials(job.id);
  if (!financial) return notFound('Job tidak ditemukan');

  return NextResponse.json(serializeJob(financial));
});

export const DELETE = handler(async (_request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { jobId } = await context.params;
  const [job] = await db
    .delete(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .returning({ id: jobsTable.id });

  if (!job) return notFound('Job tidak ditemukan');
  return NextResponse.json({ ok: true });
});
