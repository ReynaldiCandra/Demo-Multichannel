import { NextResponse } from 'next/server';
import { db, settlementsTable } from '@/lib/db';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { SettlementInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/settlements/[storeId]?month=YYYY-MM
 *
 * Tandai pencairan untuk satu toko satu bulan (upsert). Hybrid: saat
 * `released`, nominal riil dari dashboard marketplace wajib diisi; saat
 * kembali `pending`, nominal dan tanggal cair di-reset.
 */
export const PATCH = handler(async (request: Request, context: { params: Promise<{ storeId: string }> }) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { storeId } = await context.params;
  if (!UUID.test(storeId)) {
    return NextResponse.json({ error: 'storeId tidak valid' }, { status: 400 });
  }

  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!MONTH.test(month)) {
    return NextResponse.json({ error: 'Format bulan harus YYYY-MM' }, { status: 400 });
  }

  const parsed = await parseBody(request, SettlementInput);
  if (!parsed.success) return badRequest(parsed.error);

  // Hybrid: nominal riil wajib saat ditandai cair; kembali pending = reset.
  if (parsed.data.status === 'released' && !parsed.data.releasedAmount) {
    return NextResponse.json(
      { error: 'Nominal yang benar-benar cair wajib diisi saat menandai sudah dicairkan.' },
      { status: 400 },
    );
  }
  const releasedAmount = parsed.data.status === 'released' ? parsed.data.releasedAmount ?? null : null;
  const releasedDate = parsed.data.status === 'released' ? parsed.data.releasedDate : null;

  const [row] = await db
    .insert(settlementsTable)
    .values({ storeId, month, status: parsed.data.status, releasedAmount, releasedDate })
    .onConflictDoUpdate({
      target: [settlementsTable.storeId, settlementsTable.month],
      set: { status: parsed.data.status, releasedAmount, releasedDate, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json(row);
});
