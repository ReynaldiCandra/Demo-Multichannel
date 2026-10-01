import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db, tasksTable } from '@/lib/db';
import { badRequest, handler, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspace, requireWorkspaceWrite } from '@/lib/server/workspace';
import { TaskCreateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const PRIORITIES: Record<string, number> = { high: 0, normal: 1000, low: 2000 };

/** GET /api/tasks — semua kartu kanban workspace ini (dikelompokkan di client). */
export const GET = handler(async () => {
  const ctx = await requireWorkspace();
  if (isResponse(ctx)) return ctx;

  const rows = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.workspaceId, ctx.workspaceId))
    .orderBy(asc(tasksTable.position), asc(tasksTable.createdAt))
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        completedAt: row.completedAt?.toISOString() ?? null,
      })),
    );

  return NextResponse.json(rows);
});

/**
 * POST /api/tasks — buat kartu baru di kolom paling atas kolom terpilih
 * (high = atas, low = bawah supaya urutan default masuk akal).
 */
export const POST = handler(async (request: Request) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const parsed = await parseBody(request, TaskCreateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [{ min }] = await db
    .select({ min: sql<string | null>`min(${tasksTable.position})` })
    .from(tasksTable)
    .where(eq(tasksTable.workspaceId, ctx.workspaceId));
  const position = (Number(min) || 0) - 100;

  const [task] = await db
    .insert(tasksTable)
    .values({
      workspaceId: ctx.workspaceId,
      title: parsed.data.title,
      notes: parsed.data.notes,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate,
      position: Math.min(position, PRIORITIES[parsed.data.priority] ?? 1000),
    })
    .returning();

  return NextResponse.json(
    { ...task, completedAt: task.completedAt?.toISOString() ?? null },
    { status: 201 },
  );
});

