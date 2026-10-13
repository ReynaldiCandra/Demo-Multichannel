import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { channelLogosTable, db } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { requireWorkspace, requireWorkspaceWrite, isResponse } from '@/lib/server/workspace';
import { ChannelLogoDeleteInput, ChannelLogoInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/** Daftar logo kanal workspace ini — dipakai ChannelAvatar & Pengaturan. */
export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const rows = await db
    .select({
      channel: channelLogosTable.channel,
      channelKey: channelLogosTable.channelKey,
      logoUrl: channelLogosTable.logoUrl,
      updatedAt: channelLogosTable.updatedAt,
    })
    .from(channelLogosTable)
    .where(eq(channelLogosTable.workspaceId, ctx.workspaceId))
    .orderBy(desc(channelLogosTable.updatedAt));

  return NextResponse.json({ logos: rows });
});

/** Upsert logo satu kanal: insert, atau replace URL logo yang sudah ada. */
export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, ChannelLogoInput);
  if (!parsed.success) return badRequest(parsed.error);

  const { channel, logoUrl } = parsed.data;
  const channelKey = channel.toLowerCase().trim();
  const [logo] =  await db
    .insert(channelLogosTable)
    .values({
      workspaceId: ctx.workspaceId,
      channel,
      channelKey,
      logoUrl,
    })
    .onConflictDoUpdate({
      target: [channelLogosTable.workspaceId, channelLogosTable.channelKey],
      set: { channel, logoUrl, updatedAt: new Date() },
    })
    .returning({
      channel: channelLogosTable.channel,
      channelKey: channelLogosTable.channelKey,
      logoUrl: channelLogosTable.logoUrl,
    });

  return NextResponse.json(logo, { status: 201 });
});

/** Hapus logo kanal (kembali ke SVG simple-icons / inisial fallback). */
export const DELETE = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, ChannelLogoDeleteInput);
  if (!parsed.success) return badRequest(parsed.error);

  await db
    .delete(channelLogosTable)
    .where(
      and(
        eq(channelLogosTable.workspaceId, ctx.workspaceId),
        eq(channelLogosTable.channelKey, parsed.data.channel.toLowerCase().trim()),
      ),
    );

  return NextResponse.json({ ok: true });
});
