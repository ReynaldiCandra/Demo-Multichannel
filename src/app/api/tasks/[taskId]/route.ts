import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, tasksTable } from '@/lib/db';
import { badRequest, handler, notFound, parseBody } from '@/lib/server/http';
import { isResponse, requireWorkspaceWrite } from '@/lib/server/workspace';
import { TaskUpdateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ taskId: string }> };

/**
 * PATCH /api/tasks/[taskId] — edit kartu, pindah kolom (status), atau
 * mengatur posisi hasil drag & drop. completed_at diisi otomatis saat
 * status berubah ke done dan dikosongkan saat keluar dari done.
 */
export const PATCH = handler(async (request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { taskId } = await context.params;
  if (!UUID.test(taskId)) {
    return NextResponse.json({ error: 'taskId tidak valid' }, { status: 400 });
  }

  const parsed = await parseBody(request, TaskUpdateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const scope = and(eq(tasksTable.id, taskId), eq(tasksTable.workspaceId, ctx.workspaceId));
  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(scope)
    .limit(1);
  if (!existing) return notFound('Tugas tidak ditemukan.');

  const input = parsed.data;
  const status = input.status ?? (existing.status as 'todo' | 'doing' | 'done');
  const now = new Date();
  const wasDone = existing.status === 'done';

  const [task] = await db
    .update(tasksTable)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.position !== undefined && { position: input.position }),
      ...(input.status !== undefined && {
        completedAt: status === 'done' ? (wasDone ? existing.completedAt : now) : null,
      }),
      updatedAt: now,
    })
    .where(scope)
    .returning();

  if (!task) return notFound('Tugas tidak ditemukan.');
  return NextResponse.json({ ...task, completedAt: task.completedAt?.toISOString() ?? null });
});

/** DELETE /api/tasks/[taskId] — hapus kartu. */
export const DELETE = handler(async (_request: Request, context: Context) => {
  const ctx = await requireWorkspaceWrite();
  if (isResponse(ctx)) return ctx;

  const { taskId } = await context.params;
  if (!UUID.test(taskId)) {
    return NextResponse.json({ error: 'taskId tidak valid' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.workspaceId, ctx.workspaceId)))
    .returning();
  if (!deleted) return notFound('Tugas tidak ditemukan.');

  return NextResponse.json({ ok: true });
});
