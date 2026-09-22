'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Power, Trash2, UserRound, UsersRound } from 'lucide-react';
import {
  useCreateHost,
  useCreateLiveSession,
  useDeleteHost,
  useDeleteLiveSession,
  useListHosts,
  useListLiveSessions,
  useListStores,
  useUpdateHost,
  useUpdateLiveSession,
} from '@/lib/api/hooks';
import type { Host, LiveSessionRow } from '@/lib/api/types';
import { Badge, Button, Field, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { dateLabel, money, monthLabel, monthNow, number, today } from '@/lib/format';

const PAGE_SIZE = 10;

export default function LivePage() {
  const hosts = useListHosts();
  const sessions = useListLiveSessions({ month: monthNow });
  const stores = useListStores();

  const [modal, setModal] = useState<'host' | 'session' | null>(null);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [editingSession, setEditingSession] = useState<LiveSessionRow | null>(null);
  const [hostPage, setHostPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const close = () => {
    setModal(null);
    setEditingHost(null);
    setEditingSession(null);
  };

  const createHost = useCreateHost({ onSuccess: close });
  const updateHost = useUpdateHost({ onSuccess: close });
  const deleteHost = useDeleteHost();
  const createSession = useCreateLiveSession({ onSuccess: close });
  const updateSession = useUpdateLiveSession({
    onSuccess: () => {
      if (modal === 'session') close();
    },
  });
  const deleteSession = useDeleteLiveSession();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (modal === 'host') {
      const data = {
        name: String(form.get('name')),
        phone: String(form.get('phone') || '') || null,
        commissionType: String(form.get('commissionType')),
        rate: Number(form.get('rate')),
        isActive: editingHost ? editingHost.isActive : true,
      };
      if (editingHost) {
        updateHost.mutate({ hostId: editingHost.id, data });
      } else createHost.mutate({ data });
      return;
    }

    const data = {
      hostId: String(form.get('hostId')),
      storeId: String(form.get('storeId')),
      date: String(form.get('date')),
      startTime: String(form.get('startTime') || '') || null,
      endTime: String(form.get('endTime') || '') || null,
      totalOrders: Number(form.get('totalOrders') || 0),
      totalRevenue: Number(form.get('totalRevenue') || 0),
      commissionAmount: Number(form.get('commissionAmount') || 0),
      commissionPaid: editingSession?.commissionPaid ?? false,
      notes: String(form.get('notes') || '') || null,
    };
    if (editingSession) updateSession.mutate({ liveSessionId: editingSession.id, data });
    else createSession.mutate({ data });
  };

  const markCommissionPaid = (item: LiveSessionRow) =>
    updateSession.mutate({
      liveSessionId: item.id,
      data: { commissionPaid: true },
    });

  const toggleHost = (host: Host) =>
    updateHost.mutate({ hostId: host.id, data: { isActive: !host.isActive } });

  const hostRows = hosts.data ?? [];
  const sessionRows = sessions.data ?? [];

  return (
    <>
      <PageTitle
        eyebrow="LIVE SELLING / SESI"
        title="Live yang terukur."
        description="Host, jam tayang, order, sampai komisi—semua tercatat."
        action={
          <div className="button-pair">
            <Button variant="secondary" onClick={() => setModal('host')}>
              <UserRound size={15} /> Tambah host
            </Button>
            <Button onClick={() => setModal('session')}>
              <Plus size={16} /> Catat sesi
            </Button>
          </div>
        }
      />

      <div className="live-grid">
        <Panel>
          <div className="section-head">
            <div>
              <div className="eyebrow">HOST AKTIF</div>
              <h2>Tim host</h2>
            </div>
            <UsersRound size={18} className="muted" />
          </div>
          {hosts.isLoading ? (
            <State type="loading" />
          ) : !hostRows.length ? (
            <State type="empty" />
          ) : (
            <div className="host-list">
               {hostRows.slice((hostPage - 1) * PAGE_SIZE, hostPage * PAGE_SIZE).map((host) => (
                <div className="host-row" key={host.id} data-testid={`row-host-${host.id}`}>
                  <span className="avatar avatar-teal">
                    {host.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{host.name}</strong>
                    <small>
                      {host.commissionType === 'per_hour'
                        ? 'Per jam'
                        : host.commissionType === 'per_order'
                          ? 'Per order'
                          : '% revenue'}{' '}
                      · {money(host.rate)}
                    </small>
                  </div>
                  <div className="button-pair table-actions">
                    <Badge tone={host.isActive ? 'good' : 'neutral'}>
                      {host.isActive ? 'Aktif' : 'Off'}
                    </Badge>
                    <button
                      className="icon-btn"
                      onClick={() => toggleHost(host)}
                      aria-label={host.isActive ? 'Nonaktifkan host' : 'Aktifkan host'}
                      title={host.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      data-testid={`button-toggle-host-${host.id}`}
                    >
                      <Power size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setEditingHost(host);
                        setModal('host');
                      }}
                      aria-label="Edit host"
                      data-testid={`button-edit-host-${host.id}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn danger-icon"
                      onClick={() => {
                        if (window.confirm(`Hapus host "${host.name}"?`)) {
                          deleteHost.mutate({ hostId: host.id });
                        }
                      }}
                      aria-label="Hapus host"
                      data-testid={`button-delete-host-${host.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!hosts.isLoading && hostRows.length > 0 && (
            <Pagination page={hostPage} totalPages={Math.ceil(hostRows.length / PAGE_SIZE)} onPageChange={setHostPage} />
          )}
        </Panel>

        <Panel className="session-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">HASIL BULAN INI</div>
              <h2>Session terbaru</h2>
            </div>
            <span className="mono muted">{monthLabel(monthNow)}</span>
          </div>
          {sessions.isLoading ? (
            <State type="loading" />
          ) : !sessionRows.length ? (
            <State type="empty" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Host</th>
                    <th>Toko</th>
                    <th>Order</th>
                    <th>Omzet</th>
                    <th>Komisi</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                   {sessionRows.slice((sessionPage - 1) * PAGE_SIZE, sessionPage * PAGE_SIZE).map((item) => (
                    <tr key={item.id} data-testid={`row-session-${item.id}`}>
                      <td>{dateLabel(item.date)}</td>
                      <td>
                        <strong>{item.hostName}</strong>
                      </td>
                      <td>{item.storeName}</td>
                      <td className="mono">{number(item.totalOrders)}</td>
                      <td className="mono">{money(item.totalRevenue)}</td>
                      <td className="mono">{money(item.commissionAmount)}</td>
                      <td>
                        <div className="button-pair table-actions">
                          {item.commissionPaid ? (
                            <Badge tone="good">Dibayar</Badge>
                          ) : (
                            <button
                              className="mini-action"
                              onClick={() => markCommissionPaid(item)}
                              disabled={updateSession.isPending}
                              data-testid={`button-pay-commission-${item.id}`}
                            >
                              Tandai dibayar
                            </button>
                          )}
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setEditingSession(item);
                              setModal('session');
                            }}
                            aria-label="Edit sesi"
                            data-testid={`button-edit-session-${item.id}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn danger-icon"
                            onClick={() => {
                              if (window.confirm(`Hapus sesi live ${dateLabel(item.date)}?`)) {
                                deleteSession.mutate({ liveSessionId: item.id });
                              }
                            }}
                            aria-label="Hapus sesi"
                            data-testid={`button-delete-session-${item.id}`}
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
          {!sessions.isLoading && sessionRows.length > 0 && (
            <Pagination page={sessionPage} totalPages={Math.ceil(sessionRows.length / PAGE_SIZE)} onPageChange={setSessionPage} />
          )}
        </Panel>
      </div>

      {modal && (
        <Modal
          title={
            modal === 'host'
              ? `${editingHost ? 'Edit' : 'Tambah'} host`
              : `${editingSession ? 'Edit' : 'Catat'} sesi live`
          }
          onClose={close}
        >
          <form className="form-grid" onSubmit={submit}>
            {modal === 'host' ? (
              <>
                <Field label="Nama host">
                  <input
                    name="name"
                    defaultValue={editingHost?.name}
                    required
                    data-testid="input-host-name"
                  />
                </Field>
                <Field label="Nomor telepon">
                  <input name="phone" defaultValue={editingHost?.phone ?? ''} />
                </Field>
                <Field label="Model komisi">
                  <select name="commissionType" defaultValue={editingHost?.commissionType || 'per_hour'}>
                    <option value="per_hour">Per jam</option>
                    <option value="per_order">Per order</option>
                    <option value="percentage_revenue">% revenue</option>
                  </select>
                </Field>
                <Field label="Rate">
                  <input name="rate" type="number" min="0" defaultValue={editingHost?.rate ?? 0} required />
                </Field>
              </>
            ) : (
              <>
                <Field label="Host">
                  <select name="hostId" defaultValue={editingSession?.hostId || ''} required>
                    <option value="">Pilih host</option>
                    {hostRows.map((host) => (
                      <option value={host.id} key={host.id}>
                        {host.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Toko">
                  <select name="storeId" defaultValue={editingSession?.storeId || ''} required>
                    <option value="">Pilih toko</option>
                    {(stores.data ?? []).map((store) => (
                      <option value={store.id} key={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tanggal">
                  <input
                    name="date"
                    type="date"
                    defaultValue={editingSession?.date?.slice(0, 10) || today()}
                    required
                  />
                </Field>
                <Field label="Jam mulai">
                  <input name="startTime" type="time" defaultValue={editingSession?.startTime ?? ''} />
                </Field>
                <Field label="Jam selesai">
                  <input name="endTime" type="time" defaultValue={editingSession?.endTime ?? ''} />
                </Field>
                <Field label="Total order">
                  <input
                    name="totalOrders"
                    type="number"
                    min="0"
                    defaultValue={editingSession?.totalOrders ?? 0}
                  />
                </Field>
                <Field label="Total omzet">
                  <input
                    name="totalRevenue"
                    type="number"
                    min="0"
                    defaultValue={editingSession?.totalRevenue ?? 0}
                  />
                </Field>
                <Field label="Komisi">
                  <input
                    name="commissionAmount"
                    type="number"
                    min="0"
                    defaultValue={editingSession?.commissionAmount ?? 0}
                  />
                </Field>
                <Field label="Catatan">
                  <textarea name="notes" defaultValue={editingSession?.notes ?? ''} />
                </Field>
              </>
            )}
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
