import { NextResponse } from 'next/server';
import { asc, sql } from 'drizzle-orm';
import { db, tasksTable } from '@/lib/db';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { TaskCreateInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const PRIORITIES: Record<string, number> = { high: 0, normal: 1000, low: 2000 };

/** GET /api/tasks — semua kartu kanban (dikelompokkan di client). */
export const GET = handler(async () =>
  NextResponse.json(
    await db
      .select()
      .from(tasksTable)
      .orderBy(asc(tasksTable.position), asc(tasksTable.createdAt))
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          completedAt: row.completedAt?.toISOString() ?? null,
        })),
      ),
  ),
);

/**
 * POST /api/tasks — buat kartu baru di kolom paling atas kolom terpilih
 * (high = atas, low = bawah supaya urutan default masuk akal).
 */
export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, TaskCreateInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [{ min }] = await db
    .select({ min: sql<string | null>`min(${tasksTable.position})` })
    .from(tasksTable);
  const position = (Number(min) || 0) - 100;

  const [task] = await db
    .insert(tasksTable)
    .values({
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
