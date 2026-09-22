import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, jobPaymentsTable, jobsTable } from '@/lib/db';
import { dateOnly } from '@/lib/server/dashboard';
import { badRequest, handler, notFound, parseBody, requireWriteAccess } from '@/lib/server/http';
import { JobPaymentInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ jobId: string }> };

export const POST = handler(async (request: Request, context: Context) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { jobId } = await context.params;
  const parsed = await parseBody(request, JobPaymentInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) return notFound('Job tidak ditemukan');

  const [payment] = await db
    .insert(jobPaymentsTable)
    .values({
      jobId,
      paymentDate: dateOnly(parsed.data.date)!,
      amount: parsed.data.amount,
      type: parsed.data.type,
    })
    .returning();

  return NextResponse.json(
    {
      id: payment.id,
      jobId: payment.jobId,
      date: payment.paymentDate,
      amount: payment.amount,
      type: payment.type,
    },
    { status: 201 },
  );
});
