'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ChevronRight, CircleAlert, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCreateJob, useDeleteJob, useListJobs, useUpdateJob } from '@/lib/api/hooks';
import type { JobSummary } from '@/lib/api/types';
import { Badge, Button, Field, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { cn, dateLabel, money, number, today } from '@/lib/format';

const PAGE_SIZE = 10;

export default function JobsPage() {
  const query = useListJobs();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobSummary | null>(null);
  const [page, setPage] = useState(1);
  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  const create = useCreateJob({ onSuccess: close });
  const update = useUpdateJob({ onSuccess: close });
  const remove = useDeleteJob();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      clientName: String(form.get('clientName')),
      jobType: String(form.get('jobType')),
      startDate: String(form.get('startDate')),
      deadline: String(form.get('deadline') || '') || null,
      status: String(form.get('status') || 'running'),
      contractValue: Number(form.get('contractValue')),
      notes: String(form.get('notes') || '') || null,
    };
    if (editing) update.mutate({ jobId: editing.id, data });
    else create.mutate({ data });
  };

  const jobs = query.data ?? [];

  return (
    <>
      <PageTitle
        eyebrow="JOBS / PIPELINE"
        title="Kerjaan yang menghasilkan."
        description="Jaga deadline, biaya, dan tagihan dalam satu ritme."
        action={
          <Button onClick={() => setOpen(true)} data-testid="button-add-job">
            <Plus size={16} /> Tambah job
          </Button>
        }
      />

      <div className="job-overview">
        <div>
          <span>Semua job</span>
          <strong>{number(jobs.length)}</strong>
        </div>
        <div>
          <span>Berjalan</span>
          <strong>{number(jobs.filter((job) => job.status === 'running').length)}</strong>
        </div>
        <div className="warn">
          <span>Butuh perhatian</span>
          <strong>
            {number(
              jobs.filter(
                (job) =>
                  job.status !== 'cancelled' &&
                  (job.isOverdue || job.paymentStatus !== 'paid'),
              ).length,
            )}
          </strong>
        </div>
      </div>

      <Panel className="table-panel">
        {query.isLoading ? (
          <State type="loading" />
        ) : query.isError ? (
          <State type="error" onRetry={() => query.refetch()} />
        ) : !jobs.length ? (
          <State type="empty" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Klien</th>
                  <th>Jenis</th>
                  <th>Deadline</th>
                  <th>Nilai kontrak</th>
                  <th>Sisa tagihan</th>
                  <th>Status job</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((job) => (
                  <tr
                    key={job.id}
                    className={job.isOverdue ? 'row-alert' : ''}
                    data-testid={`row-job-${job.id}`}
                  >
                    <td>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="table-link"
                        data-testid={`link-job-${job.id}`}
                      >
                        <strong>{job.clientName}</strong>
                      </Link>
                      <small className="table-sub">{dateLabel(job.startDate)}</small>
                    </td>
                    <td>{job.jobType}</td>
                    <td>
                      {job.isOverdue ? (
                        <span className="overdue">
                          <CircleAlert size={14} /> {dateLabel(job.deadline)}
                        </span>
                      ) : (
                        dateLabel(job.deadline)
                      )}
                    </td>
                    <td className="mono">{money(job.contractValue)}</td>
                    <td className={cn('mono', job.remainingBill > 0 && 'warn-text')}>
                      {money(job.remainingBill)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          job.status === 'completed'
                            ? 'good'
                            : job.status === 'cancelled'
                              ? 'neutral'
                              : 'yellow'
                        }
                      >
                        {job.status === 'completed'
                          ? 'Selesai'
                          : job.status === 'cancelled'
                            ? 'Dibatalkan'
                            : 'Berjalan'}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          job.paymentStatus === 'paid'
                            ? 'good'
                            : job.isOverdue
                              ? 'danger'
                              : 'yellow'
                        }
                      >
                        {job.paymentStatus === 'paid'
                          ? 'Lunas'
                          : job.isOverdue
                            ? 'Lewat'
                            : 'Belum lunas'}
                      </Badge>
                    </td>
                    <td>
                      <div className="button-pair table-actions">
                        <Link href={`/jobs/${job.id}`} className="icon-btn" aria-label="Buka detail">
                          <ChevronRight size={16} />
                        </Link>
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setEditing(job);
                            setOpen(true);
                          }}
                          aria-label="Edit job"
                          data-testid={`button-edit-job-${job.id}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-btn danger-icon"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Hapus job "${job.clientName}"? Semua biaya dan pembayaran job ikut dihapus.`,
                              )
                            ) {
                              remove.mutate({ jobId: job.id });
                            }
                          }}
                          aria-label="Hapus job"
                          data-testid={`button-delete-job-${job.id}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!query.isLoading && !query.isError && jobs.length > 0 && (
          <Pagination page={page} totalPages={Math.ceil(jobs.length / PAGE_SIZE)} onPageChange={setPage} />
        )}
      </Panel>

      {open && (
        <Modal title={`${editing ? 'Edit' : 'Tambah'} job`} onClose={close}>
          <form className="form-grid" onSubmit={submit}>
            <Field label="Nama klien">
              <input
                name="clientName"
                defaultValue={editing?.clientName}
                required
                data-testid="input-job-client"
              />
            </Field>
            <Field label="Jenis pekerjaan">
              <input
                name="jobType"
                placeholder="Contoh: landing page"
                defaultValue={editing?.jobType}
                required
              />
            </Field>
            <Field label="Mulai">
              <input
                name="startDate"
                type="date"
                defaultValue={editing?.startDate?.slice(0, 10) || today()}
                required
              />
            </Field>
            <Field label="Deadline">
              <input
                name="deadline"
                type="date"
                defaultValue={editing?.deadline?.slice(0, 10) || ''}
              />
            </Field>
            <Field label="Status job">
              <select name="status" defaultValue={editing?.status || 'running'}>
                <option value="running">Berjalan</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </Field>
            <Field label="Nilai kontrak">
              <input
                name="contractValue"
                type="number"
                min="0"
                defaultValue={editing?.contractValue ?? 0}
                required
              />
            </Field>
            <Field label="Catatan">
              <textarea name="notes" defaultValue={editing?.notes ?? ''} />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {create.isPending || update.isPending ? 'Menyimpan…' : 'Simpan job'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
