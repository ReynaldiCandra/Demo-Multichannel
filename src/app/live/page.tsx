'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Clock,
  Eye,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  ShoppingBag,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react';
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
  uploadHostImage,
} from '@/lib/api/hooks';
import type { Host, LiveSessionRow } from '@/lib/api/types';
import { Badge, Button, ConfirmDialog, Field, ImagePreviewButton, Modal, Panel, PageTitle, Pagination, State, type ConfirmRequest } from '@/components/ui';
import { dateLabel, money, monthLabel, monthNow, number, today } from '@/lib/format';

const PAGE_SIZE = 9;

type PeriodMode = 'week' | 'month' | 'year';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

const dayLabelOf = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? '—' : DAY_NAMES[parsed.getUTCDay()];
};

/** Durasi tayang dalam jam desimal; null kalau jam tidak lengkap/terbalik. */
const durationHoursOf = (start: string | null, end: string | null): number | null => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return null;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
};

/** ISO week string untuk tanggal: "2026-W39". */
const isoWeekOf = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return monthNow;
  const target = new Date(parsed);
  const dayNumber = (parsed.getUTCDay() + 6) % 7;
  target.setUTCDate(parsed.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export default function LivePage() {
  const hosts = useListHosts();
  const stores = useListStores();

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [monthValue, setMonthValue] = useState(monthNow);
  const [weekValue, setWeekValue] = useState(isoWeekOf(today()));
  const [yearValue, setYearValue] = useState(today().slice(0, 4));

  const period =
    periodMode === 'week' ? weekValue : periodMode === 'year' ? yearValue : monthValue;

  const sessions = useListLiveSessions({ period });

  const [modal, setModal] = useState<'host' | 'session' | null>(null);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [editingSession, setEditingSession] = useState<LiveSessionRow | null>(null);
  const [hostPage, setHostPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (modal === 'host') {
      const imageFile = form.get('image') as File | null;
      let imageUrl = editingHost?.imageUrl ?? null;
      try {
        if (imageFile && imageFile.size > 0) {
          imageUrl = (await uploadHostImage(imageFile)).url;
        }
      } catch {
        imageUrl = editingHost?.imageUrl ?? null;
      }

      const data = {
        name: String(form.get('name')),
        phone: String(form.get('phone') || '') || null,
        commissionType: String(form.get('commissionType')),
        rate: Number(form.get('rate')),
        imageUrl,
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
      totalComments: Number(form.get('totalComments') || 0),
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

  // Baris dengan metrik turunan (hari, durasi) untuk kartu & total.
  const enriched = useMemo(
    () =>
      sessionRows.map((item) => ({
        ...item,
        dayLabel: dayLabelOf(item.date),
        durationHours: durationHoursOf(item.startTime, item.endTime),
      })),
    [sessionRows],
  );

  const totals = useMemo(
    () => ({
      sessions: enriched.length,
      hours: enriched.reduce((sum, item) => sum + (item.durationHours ?? 0), 0),
      comments: enriched.reduce((sum, item) => sum + item.totalComments, 0),
      orders: enriched.reduce((sum, item) => sum + item.totalOrders, 0),
      revenue: enriched.reduce((sum, item) => sum + item.totalRevenue, 0),
      commission: enriched.reduce((sum, item) => sum + item.commissionAmount, 0),
    }),
    [enriched],
  );

  const periodLabel =
    periodMode === 'week'
      ? `Minggu ${weekValue.split('-W')[1]} ${weekValue.slice(0, 4)}`
      : periodMode === 'year'
        ? `Tahun ${yearValue}`
        : monthLabel(monthValue);

  return (
    <>
      <PageTitle
        eyebrow="LIVE SELLING / SESI"
        title="Live yang terukur."
        description="Host, jam tayang, komentar, order, sampai komisi—semua tercatat per periode."
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

      <div className="live-toolbar">
        <div className="tabs" role="tablist" aria-label="Periode laporan">
          {([
            ['week', 'Mingguan'],
            ['month', 'Bulanan'],
            ['year', 'Tahunan'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`tab ${periodMode === mode ? 'active' : ''}`}
              onClick={() => setPeriodMode(mode)}
              data-testid={`tab-live-period-${mode}`}
            >
              {label}
            </button>
          ))}
        </div>
        {periodMode === 'week' ? (
          <input
            className="month-input"
            type="week"
            value={weekValue}
            onChange={(event) => setWeekValue(event.target.value || isoWeekOf(today()))}
            data-testid="input-live-week"
          />
        ) : periodMode === 'year' ? (
          <input
            className="month-input"
            type="number"
            min="2020"
            max="2100"
            value={yearValue}
            onChange={(event) => setYearValue(event.target.value || today().slice(0, 4))}
            data-testid="input-live-year"
          />
        ) : (
          <input
            className="month-input"
            type="month"
            value={monthValue}
            onChange={(event) => setMonthValue(event.target.value || monthNow)}
            data-testid="input-live-month"
          />
        )}
        <span className="mono muted">{periodLabel}</span>
      </div>

      <div className="live-summary">
        <div className="live-stat"><small>Sesi</small><b>{number(totals.sessions)}</b></div>
        <div className="live-stat"><small>Total jam</small><b>{number(Math.round(totals.hours * 10) / 10)} jam</b></div>
        <div className="live-stat"><small>Total komentar</small><b>{number(totals.comments)}</b></div>
        <div className="live-stat"><small>Order</small><b>{number(totals.orders)}</b></div>
        <div className="live-stat"><small>Omzet</small><b>{money(totals.revenue)}</b></div>
        <div className="live-stat"><small>Komisi host</small><b>{money(totals.commission)}</b></div>
      </div>

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
                  <ImagePreviewButton src={host.imageUrl} alt={`Foto ${host.name}`} avatar emptyLabel={host.name.slice(0, 1).toUpperCase()} />
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
                      onClick={() =>
                        setConfirming({
                          message: `Hapus host "${host.name}"?`,
                          onConfirm: () => deleteHost.mutate({ hostId: host.id }),
                        })
                      }
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
              <div className="eyebrow">HASIL PERIODE INI</div>
              <h2>Sesi live</h2>
            </div>
            <span className="mono muted">{periodLabel}</span>
          </div>
          {sessions.isLoading ? (
            <State type="loading" />
          ) : !enriched.length ? (
            <State type="empty" />
          ) : (
            <div className="session-cards" data-testid="session-cards">
              {enriched
                .slice((sessionPage - 1) * PAGE_SIZE, sessionPage * PAGE_SIZE)
                .map((item) => (
                  <article className="session-card" key={item.id} data-testid={`row-session-${item.id}`}>
                    <div className="session-card-head">
                      <ImagePreviewButton src={item.hostImage} alt={`Foto ${item.hostName}`} avatar emptyLabel={item.hostName.slice(0, 1).toUpperCase()} />
                      <div className="session-card-host">
                        <strong>{item.hostName}</strong>
                        <small>{item.storeName}</small>
                      </div>
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
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-btn danger-icon"
                          onClick={() =>
                            setConfirming({
                              message: `Hapus sesi live ${dateLabel(item.date)}?`,
                              onConfirm: () => deleteSession.mutate({ liveSessionId: item.id }),
                            })
                          }
                          aria-label="Hapus sesi"
                          data-testid={`button-delete-session-${item.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="session-card-date">
                      <span className="session-day">
                        <CalendarDays size={12} /> {item.dayLabel}
                      </span>
                      <span className="session-date">{dateLabel(item.date)}</span>
                      {item.durationHours !== null && (
                        <span className="session-hours">
                          <Clock size={12} /> {item.durationHours} jam
                          {item.startTime && item.endTime ? ` (${item.startTime}–${item.endTime})` : ''}
                        </span>
                      )}
                    </div>

                    <div className="session-card-stats">
                      <div className="session-stat">
                        <ShoppingBag size={13} />
                        <span>{number(item.totalOrders)}</span>
                        <small>order</small>
                      </div>
                      <div className="session-stat">
                        <MessageCircle size={13} />
                        <span>{number(item.totalComments)}</span>
                        <small>komentar</small>
                      </div>
                      <div className="session-stat">
                        <Wallet size={13} />
                        <span>{money(item.totalRevenue)}</span>
                        <small>omzet</small>
                      </div>
                      <div className="session-stat">
                        <Eye size={13} />
                        <span>{money(item.commissionAmount)}</span>
                        <small>komisi</small>
                      </div>
                    </div>

                    {item.notes && <p className="session-card-notes">{item.notes}</p>}
                  </article>
                ))}
            </div>
          )}
          {!sessions.isLoading && enriched.length > 0 && (
            <Pagination page={sessionPage} totalPages={Math.ceil(enriched.length / PAGE_SIZE)} onPageChange={setSessionPage} />
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
                <Field label="Foto host" hint="Tampil di daftar host & kartu sesi. JPG, PNG, atau WebP.">
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    data-testid="input-host-image"
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
                <Field label="Jam selesai" hint="Durasi jam dihitung otomatis dari jam mulai–selesai.">
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
                <Field label="Total komentar" hint="Jumlah komentar saat live (engagement).">
                  <input
                    name="totalComments"
                    type="number"
                    min="0"
                    defaultValue={editingSession?.totalComments ?? 0}
                    data-testid="input-session-comments"
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
