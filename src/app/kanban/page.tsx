'use client';

import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { CalendarDays, Eye, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import {
  useCreateTask,
  useDeleteTask,
  useListTasks,
  useUpdateTask,
} from '@/lib/api/hooks';
import type { TaskPriority, TaskRow, TaskStatus } from '@/lib/api/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Modal,
  PageTitle,
  State,
  type ConfirmRequest,
} from '@/components/ui';
import { cn, dateLabel, today } from '@/lib/format';

const COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: 'todo', label: 'Belum dikerjakan' },
  { status: 'doing', label: 'Sedang dikerjakan' },
  { status: 'done', label: 'Selesai' },
];

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'Prioritas tinggi',
  normal: 'Normal',
  low: 'Santai',
};

const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'neutral' | 'good'> = {
  high: 'danger',
  normal: 'neutral',
  low: 'good',
};

type EditorState = {
  open: boolean;
  task: TaskRow | null;
  defaultStatus: TaskStatus;
};

export default function KanbanPage() {
  const tasks = useListTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [editor, setEditor] = useState<EditorState>({ open: false, task: null, defaultStatus: 'todo' });
  // Kartu yang sedang dilihat detailnya (icon mata) — isi penuh, tidak terpotong.
  const [viewing, setViewing] = useState<TaskRow | null>(null);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  // Kartu yang sedang diseret + kolom yang sedang dilalui kursor (highlight).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const rows = tasks.data ?? [];
  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = { todo: [], doing: [], done: [] };
    for (const task of rows) map[task.status]?.push(task);
    // Server sudah mengurutkan per kolom (position lalu created_at).
    return map;
  }, [rows]);

  const closeEditor = () => setEditor({ open: false, task: null, defaultStatus: 'todo' });

  /** Sisip kartu di antara dua tetangga: rata-rata posisi keduanya. */
  const positionBetween = (column: TaskRow[], target: TaskRow | null, below: boolean) => {
    if (!target) {
      const last = column[column.length - 1];
      return last ? Number(last.position) + 100 : 1000;
    }
    const index = column.findIndex((item) => item.id === target.id);
    if (below) {
      const next = column[index + 1];
      return next ? (Number(target.position) + Number(next.position)) / 2 : Number(target.position) + 100;
    }
    const prev = column[index - 1];
    return prev ? (Number(prev.position) + Number(target.position)) / 2 : Number(target.position) - 100;
  };

  const onDropCard = (event: DragEvent, status: TaskStatus, target: TaskRow | null, below: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOver(null);
    if (!id) return;
    const task = rows.find((item) => item.id === id);
    if (!task) return;
    const column = grouped[status];
    if (task.status === status && target && (target.id === task.id || column.every((c) => c.id !== target.id))) {
      // Dilepas di badan kartunya sendiri — tidak ada perubahan urutan.
      return;
    }
    const position = positionBetween(column, target, below);
    update.mutate(
      { taskId: id, data: { status, position } },
      {
        onError: () => undefined, // toast sudah dikirim useInvalidating
      },
    );
  };

  const onDropColumn = (event: DragEvent, status: TaskStatus) => {
    // Kartu dilepas di area kosong kolom = taruh di posisi paling bawah.
    onDropCard(event, status, null, false);
    setDragOver(null);
  };

  if (tasks.isLoading) return <State type="loading" />;
  if (tasks.isError) return <State type="error" onRetry={() => tasks.refetch()} />;

  return (
    <>
      <PageTitle
        eyebrow="KANBAN / TUGAS"
        title="Papan kerja harian."
        description="Seret kartu antar kolom untuk memindahkan status. Kartu bisa diurutkan di dalam kolom."
        action={
          <Button
            onClick={() => setEditor({ open: true, task: null, defaultStatus: 'todo' })}
            data-testid="button-create-task"
          >
            <Plus size={15} /> Tugas baru
          </Button>
        }
      />

      {rows.length === 0 ? (
        <State type="empty" />
      ) : (
        <div className="kanban-board" data-testid="kanban-board">
          {COLUMNS.map((column) => {
            const cards = grouped[column.status];
            return (
              <section
                key={column.status}
                className={cn('kanban-column', dragOver === column.status && 'drag-over')}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(column.status);
                }}
                onDragLeave={() => setDragOver((prev) => (prev === column.status ? null : prev))}
                onDrop={(event) => onDropColumn(event, column.status)}
                data-testid={`kanban-column-${column.status}`}
              >
                <header className="kanban-column-head">
                  <h2>{column.label}</h2>
                  <span className="kanban-count">{cards.length}</span>
                </header>

                <div className="kanban-cards">
                  {cards.map((card) => (
                    <article
                      key={card.id}
                      className={cn('kanban-card', card.status === 'done' && 'done', draggingId === card.id && 'dragging')}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', card.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDraggingId(card.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                      onDrop={(event) => {
                        // Separuh atas kartu = taruh di atasnya; bawah = di bawahnya.
                        const rect = event.currentTarget.getBoundingClientRect();
                        const below = event.clientY > rect.top + rect.height / 2;
                        onDropCard(event, card.status, card, below);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      data-testid={`kanban-card-${card.id}`}
                    >
                      <div className="kanban-card-top">
                        <span className="kanban-card-title">{card.title}</span>
                        <div className="kanban-card-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setViewing(card)}
                            aria-label="Lihat detail tugas"
                            title="Lihat detail"
                            data-testid={`button-view-task-${card.id}`}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setEditor({ open: true, task: card, defaultStatus: card.status })}
                            aria-label="Edit tugas"
                            data-testid={`button-edit-task-${card.id}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger-icon"
                            onClick={() =>
                              setConfirming({
                                message: `Hapus tugas "${card.title}"?`,
                                onConfirm: () => remove.mutate({ taskId: card.id }),
                              })
                            }
                            aria-label="Hapus tugas"
                            data-testid={`button-delete-task-${card.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {card.notes && <p className="kanban-card-notes">{card.notes}</p>}

                      <div className="kanban-card-meta">
                        <Badge tone={PRIORITY_TONE[card.priority]}>{PRIORITY_LABEL[card.priority]}</Badge>
                        {card.dueDate && (
                          <span
                            className={cn(
                              'kanban-due',
                              card.status !== 'done' && card.dueDate < today() && 'overdue',
                            )}
                          >
                            <CalendarDays size={11} /> {dateLabel(card.dueDate)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}

                  <button
                    type="button"
                    className="kanban-add"
                    onClick={() => setEditor({ open: true, task: null, defaultStatus: column.status })}
                    data-testid={`button-add-task-${column.status}`}
                  >
                    <Plus size={13} /> Tambah kartu
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {viewing && (
        <TaskDetailModal
          task={viewing}
          onClose={() => setViewing(null)}
          onEdit={(task) => {
            setViewing(null);
            setEditor({ open: true, task, defaultStatus: task.status });
          }}
        />
      )}

      {editor.open && (
        <TaskFormModal
          task={editor.task}
          defaultStatus={editor.defaultStatus}
          onClose={closeEditor}
          onCreate={(data) => create.mutate({ data }, { onSuccess: closeEditor })}
          onUpdate={(taskId, data) =>
            update.mutate({ taskId, data }, { onSuccess: closeEditor })
          }
          pending={create.isPending || update.isPending}
        />
      )}

      {confirming && (
        <ConfirmDialog
          message={confirming.message}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            confirming.onConfirm();
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}

/** Modal lihat detail: isi tugas utuh (judul, prioritas, tenggat, catatan) tanpa terpotong. */
function TaskDetailModal({
  task,
  onClose,
  onEdit,
}: {
  task: TaskRow;
  onClose: () => void;
  onEdit: (task: TaskRow) => void;
}) {
  return (
    <Modal title="Detail tugas" onClose={onClose}>
      <div className="task-detail" data-testid="task-detail-modal">
        <h3 className="task-detail-title">{task.title}</h3>
        <div className="kanban-card-meta" style={{ marginBottom: 10 }}>
          <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
          <Badge tone="neutral">
            {COLUMNS.find((column) => column.status === task.status)?.label ?? task.status}
          </Badge>
          {task.dueDate && (
            <span
              className={cn(
                'kanban-due',
                task.status !== 'done' && task.dueDate < today() && 'overdue',
              )}
            >
              <CalendarDays size={11} /> {dateLabel(task.dueDate)}
            </span>
          )}
        </div>
        {task.notes ? (
          <p className="task-detail-notes">{task.notes}</p>
        ) : (
          <p className="task-detail-notes muted">Tidak ada catatan.</p>
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={() => onEdit(task)} data-testid="button-detail-edit-task">
            <Pencil size={13} /> Edit tugas
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TaskFormModal({
  task,
  defaultStatus,
  onClose,
  onCreate,
  onUpdate,
  pending,
}: {
  task: TaskRow | null;
  defaultStatus: TaskStatus;
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
  onUpdate: (taskId: string, data: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      title: title.trim(),
      notes: notes.trim() || null,
      priority,
      dueDate: dueDate || null,
      status,
    };
    if (task) onUpdate(task.id, data);
    else onCreate(data);
  };

  return (
    <Modal title={task ? 'Edit tugas' : 'Tugas baru'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Judul" hint="Ringkas dan jelas, mis. Balas email supplier.">
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} />
        </Field>
        <Field label="Kolom">
          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
            {COLUMNS.map((column) => (
              <option key={column.status} value={column.status}>
                {column.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioritas">
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
          >
            <option value="high">Prioritas tinggi</option>
            <option value="normal">Normal</option>
            <option value="low">Santai</option>
          </select>
        </Field>
        <Field label="Tenggat" hint="Opsional — kartu merah kalau lewat.">
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <Field label="Catatan" hint="Opsional — detail langkah atau link.">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-submit-task">
            {pending ? 'Menyimpan…' : task ? 'Simpan perubahan' : 'Buat tugas'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
