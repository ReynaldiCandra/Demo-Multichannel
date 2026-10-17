import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, profitSettingsTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { ProfitSettingsInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profit-settings — pengaturan kalkulator profit workspace.
 * Baris dibuat otomatis (default Rp50.000, buffer 0%) saat dibaca pertama kali.
 */
export const GET = handler(async () => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const settings = await ensureSettings(ctx.workspaceId);
  return NextResponse.json({
    defaultTargetProfitPcs: settings.defaultTargetProfitPcs,
    safetyMarginPercent: Number(settings.safetyMarginPercent) || 0,
  });
});

/** PATCH /api/profit-settings — ubah default target / margin keamanan. */
export const PATCH = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, ProfitSettingsInput);
  if (!parsed.success) return badRequest(parsed.error);

  await ensureSettings(ctx.workspaceId);

  const { defaultTargetProfitPcs, safetyMarginPercent } = parsed.data;
  const [updated] = await db
    .update(profitSettingsTable)
    .set({
      ...(defaultTargetProfitPcs === undefined
        ? {}
        : { defaultTargetProfitPcs }),
      ...(safetyMarginPercent === undefined
        ? {}
        : { safetyMarginPercent: String(safetyMarginPercent) }),
      updatedAt: new Date(),
    })
    .where(eq(profitSettingsTable.workspaceId, ctx.workspaceId))
    .returning();

  return NextResponse.json({
    defaultTargetProfitPcs: updated.defaultTargetProfitPcs,
    safetyMarginPercent: Number(updated.safetyMarginPercent) || 0,
  });
});

/** Baca baris settings workspace; buat default kalau belum ada. */
async function ensureSettings(workspaceId: string) {
  const [existing] = await db
    .select()
    .from(profitSettingsTable)
    .where(eq(profitSettingsTable.workspaceId, workspaceId));
  if (existing) return existing;

  const [created] = await db
    .insert(profitSettingsTable)
    .values({ workspaceId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Race dengan workspace lain yang baru pertama membaca — ambil ulang.
  const [row] = await db
    .select()
    .from(profitSettingsTable)
    .where(eq(profitSettingsTable.workspaceId, workspaceId));
  return row;
}
