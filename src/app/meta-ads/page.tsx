'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useCreateMetaAdTest,
  useDeleteMetaAdTest,
  useListMetaAdTests,
  useUpdateMetaAdTest,
} from '@/lib/api/hooks';
import type { MetaAdTestRow } from '@/lib/api/types';
import { Badge, Button, Field, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { dateLabel, money, number } from '@/lib/format';

const PAGE_SIZE = 10;

export default function MetaAdsPage() {
  const query = useListMetaAdTests();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MetaAdTestRow | null>(null);
  const [page, setPage] = useState(1);

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const create = useCreateMetaAdTest({ onSuccess: close });
  const update = useUpdateMetaAdTest({ onSuccess: close });
  const remove = useDeleteMetaAdTest();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      productName: String(form.get('productName')),
      startDate: String(form.get('startDate')),
      endDate: String(form.get('endDate') || '') || null,
      status: String(form.get('status')),
      totalSpend: Number(form.get('totalSpend') || 0),
      totalLeads: Number(form.get('totalLeads') || 0),
      totalClosing: Number(form.get('totalClosing') || 0),
      totalRevenue: Number(form.get('totalRevenue') || 0),
      notes: String(form.get('notes') || '') || null,
    };

    if (editing) update.mutate({ metaAdTestId: editing.id, data });
    else create.mutate({ data });
  };

  const rows = query.data ?? [];

  return (
    <>
      <PageTitle
        eyebrow="EXPERIMENTS / META ADS"
        title="Uji iklan, bukan perasaan."
        description="Log manual untuk tahu mana creative yang layak diteruskan."
        action={
          <Button onClick={() => setOpen(true)} data-testid="button-add-meta-test">
            <Plus size={16} /> Tambah tes
          </Button>
        }
      />

      <Panel className="experiment-strip">
        <div>
          <span className="eyebrow">PRINSIP</span>
          <strong>Spend kecil. Catatan jelas. Keputusan cepat.</strong>
        </div>
        <div className="strip-stats">
          <span>
            <b>{number(rows.length)}</b> tes tercatat
          </span>
          <span>
            <b>{money(rows.reduce((sum, row) => sum + Number(row.totalSpend || 0), 0))}</b> total
            spend
          </span>
        </div>
      </Panel>

      <Panel className="table-panel">
        {query.isLoading ? (
          <State type="loading" />
        ) : query.isError ? (
          <State type="error" onRetry={() => query.refetch()} />
        ) : !rows.length ? (
          <State type="empty" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Status</th>
                  <th>Spend</th>
                  <th>Leads</th>
                  <th>Closing</th>
                  <th>CPL</th>
                  <th>Revenue</th>
                  <th>Update</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
                  <tr key={item.id} data-testid={`row-meta-test-${item.id}`}>
                    <td>
                      <strong>{item.productName}</strong>
                      <small className="table-sub">
                        {dateLabel(item.startDate)}
                        {item.endDate ? ` — ${dateLabel(item.endDate)}` : ''}
                      </small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          item.status === 'running'
                            ? 'yellow'
                            : item.status === 'completed'
                              ? 'good'
                              : 'neutral'
                        }
                      >
                        {item.status === 'running'
                          ? 'Berjalan'
                          : item.status === 'completed'
                            ? 'Selesai'
                            : 'Dihentikan'}
                      </Badge>
                    </td>
                    <td className="mono">{money(item.totalSpend)}</td>
                    <td className="mono">{number(item.totalLeads)}</td>
                    <td className="mono">{number(item.totalClosing)}</td>
                    <td className="mono">{item.costPerLead ? money(item.costPerLead) : '—'}</td>
                    <td className="mono">{money(item.totalRevenue)}</td>
                    <td className="muted">{dateLabel(item.lastUpdated)}</td>
                      <td>
                        <div className="button-pair table-actions">
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setEditing(item);
                              setOpen(true);
                            }}
                            aria-label="Edit tes"
                            data-testid={`button-edit-meta-${item.id}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn danger-icon"
                            onClick={() => {
                              if (window.confirm(`Hapus tes "${item.productName}"?`)) {
                                remove.mutate({ metaAdTestId: item.id });
                              }
                            }}
                            aria-label="Hapus tes"
                            data-testid={`button-delete-meta-${item.id}`}
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
        {!query.isLoading && !query.isError && rows.length > 0 && (
          <Pagination page={page} totalPages={Math.ceil(rows.length / PAGE_SIZE)} onPageChange={setPage} />
        )}
      </Panel>

      {open && (
        <Modal title={`${editing ? 'Edit' : 'Tambah'} tes iklan`} onClose={close}>
          <form className="form-grid" onSubmit={submit}>
            <Field label="Nama produk / creative">
              <input
                name="productName"
                defaultValue={editing?.productName}
                required
                data-testid="input-meta-product"
              />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={editing?.status || 'running'}>
                <option value="running">Berjalan</option>
                <option value="completed">Selesai</option>
                <option value="stopped">Dihentikan</option>
              </select>
            </Field>
            <Field label="Mulai">
              <input
                name="startDate"
                type="date"
                defaultValue={editing?.startDate?.slice(0, 10)}
                required
                data-testid="input-meta-start"
              />
            </Field>
            <Field label="Selesai">
              <input name="endDate" type="date" defaultValue={editing?.endDate?.slice(0, 10)} />
            </Field>
            <Field label="Total spend">
              <input
                name="totalSpend"
                type="number"
                min="0"
                defaultValue={editing?.totalSpend ?? 0}
              />
            </Field>
            <Field label="Total leads">
              <input
                name="totalLeads"
                type="number"
                min="0"
                defaultValue={editing?.totalLeads ?? 0}
              />
            </Field>
            <Field label="Total closing">
              <input
                name="totalClosing"
                type="number"
                min="0"
                defaultValue={editing?.totalClosing ?? 0}
              />
            </Field>
            <Field label="Total revenue">
              <input
                name="totalRevenue"
                type="number"
                min="0"
                defaultValue={editing?.totalRevenue ?? 0}
              />
            </Field>
            <Field label="Catatan">
              <textarea name="notes" defaultValue={editing?.notes ?? ''} />
            </Field>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit">Simpan tes</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
