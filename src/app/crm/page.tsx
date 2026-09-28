'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarClock,
  Flame,
  Handshake,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  Users,
} from 'lucide-react';
import {
  useCreateCrmClient,
  useCreateCrmLead,
  useCreateCrmProduct,
  useDeleteCrmClient,
  useDeleteCrmLead,
  useDeleteCrmProduct,
  useListCrmClients,
  useListCrmLeads,
  useListCrmProducts,
  useUpdateCrmLead,
} from '@/lib/api/hooks';
import type { CrmLeadCategory, CrmLeadRow } from '@/lib/api/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Modal,
  PageTitle,
  Panel,
  State,
  type ConfirmRequest,
} from '@/components/ui';
import { cn, dateLabel, today } from '@/lib/format';

const CATEGORY_LABEL: Record<CrmLeadCategory, string> = {
  hot: 'Hot',
  warm: 'Warm',
  closing: 'Closing',
  follow_up: 'Follow-up',
};

const CATEGORY_TONE: Record<CrmLeadCategory, 'danger' | 'yellow' | 'good' | 'neutral'> = {
  hot: 'danger',
  warm: 'yellow',
  closing: 'good',
  follow_up: 'neutral',
};

const SOURCE_LABEL: Record<string, string> = {
  meta: 'Meta Ads',
  google: 'Google',
  shopee_ads: 'Shopee Ads',
  tiktok_ads: 'TikTok Ads',
  organik: 'Organik',
  lainnya: 'Lainnya',
};

type TabKey = 'pipeline' | 'klien' | 'produk';

export default function CrmPage() {
  const [tab, setTab] = useState<TabKey>('pipeline');
  const [filterClient, setFilterClient] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const [leadModal, setLeadModal] = useState<{ open: boolean; lead: CrmLeadRow | null }>({
    open: false,
    lead: null,
  });
  const [clientModal, setClientModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [productModal, setProductModal] = useState<{ open: boolean; editId?: string }>({ open: false });

  const clients = useListCrmClients();
  const products = useListCrmProducts(
    filterClient ? { clientId: filterClient } : {},
  );
  const leads = useListCrmLeads({
    clientId: filterClient || undefined,
    source: filterSource || undefined,
    search: search || undefined,
  });

  const createLead = useCreateCrmLead();
  const updateLead = useUpdateCrmLead();
  const deleteLead = useDeleteCrmLead();
  const createClient = useCreateCrmClient();
  const deleteClient = useDeleteCrmClient();
  const createProduct = useCreateCrmProduct();
  const deleteProduct = useDeleteCrmProduct();

  const data = leads.data;
  const rows = useMemo(() => data?.leads ?? [], [data]);
  const counts = data?.counts;

  const grouped = useMemo(() => {
    const map: Record<CrmLeadCategory, CrmLeadRow[]> = {
      hot: [],
      warm: [],
      closing: [],
      follow_up: [],
    };
    for (const lead of rows) map[lead.category]?.push(lead);
    return map;
  }, [rows]);

  const dueCount = rows.filter(
    (lead) =>
      lead.category !== 'closing' &&
      (!lead.followUpAt || lead.followUpAt <= today()),
  ).length;

  return (
    <>
      <PageTitle
        eyebrow="CRM / LEADS"
        title="Calon pembeli, terkelola."
        description="Pipeline per klien & produk: hot, warm, closing, follow-up. Semua hasil iklan masuk ke satu papan."
        action={
          <Button onClick={() => setLeadModal({ open: true, lead: null })} data-testid="button-add-lead">
            <Plus size={16} /> Tambah lead
          </Button>
        }
      />

      <div className="crm-toolbar">
        <select
          value={filterClient}
          onChange={(event) => setFilterClient(event.target.value)}
          aria-label="Filter klien"
          data-testid="filter-crm-client"
        >
          <option value="">Semua klien</option>
          {(clients.data ?? []).map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(event) => setFilterSource(event.target.value)}
          aria-label="Filter sumber iklan"
          data-testid="filter-crm-source"
        >
          <option value="">Semua sumber</option>
          {Object.entries(SOURCE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama / no. HP / daerah…"
          aria-label="Cari lead"
          data-testid="input-crm-search"
        />
        <div className="crm-tabs">
          <button
            type="button"
            className={cn(tab === 'pipeline' && 'active')}
            onClick={() => setTab('pipeline')}
          >
            Pipeline
          </button>
          <button
            type="button"
            className={cn(tab === 'klien' && 'active')}
            onClick={() => setTab('klien')}
          >
            Klien ({clients.data?.length ?? 0})
          </button>
          <button
            type="button"
            className={cn(tab === 'produk' && 'active')}
            onClick={() => setTab('produk')}
          >
            Produk ({products.data?.length ?? 0})
          </button>
        </div>
      </div>

      {leads.isLoading ? (
        <State type="loading" />
      ) : leads.isError ? (
        <State type="error" onRetry={() => leads.refetch()} />
      ) : tab === 'pipeline' ? (
        <>
          {counts && (
            <div className="crm-chips">
              {(Object.keys(CATEGORY_LABEL) as CrmLeadCategory[]).map((key) => (
                <span key={key} className="crm-chip">
                  <Badge tone={CATEGORY_TONE[key]}>{CATEGORY_LABEL[key]}</Badge>
                  <b data-testid={`crm-count-${key}`}>{counts[key] ?? 0}</b>
                </span>
              ))}
              <span className="crm-chip">
                <Badge tone={dueCount ? 'warn' : 'neutral'}>
                  <CalendarClock size={11} /> Perlu follow-up
                </Badge>
                <b data-testid="crm-count-due">{dueCount}</b>
              </span>
            </div>
          )}

          {rows.length === 0 ? (
            <State type="empty" />
          ) : (
            <div className="crm-board" data-testid="crm-board">
              {(Object.keys(CATEGORY_LABEL) as CrmLeadCategory[]).map((category) => (
                <section key={category} className="crm-column" data-testid={`crm-column-${category}`}>
                  <header className="crm-column-head">
                    <h2>{CATEGORY_LABEL[category]}</h2>
                    <span className="crm-count">{grouped[category].length}</span>
                  </header>
                  <div className="crm-cards">
                    {grouped[category].map((lead) => (
                      <article key={lead.id} className="crm-card" data-testid={`crm-card-${lead.id}`}>
                        <div className="kanban-card-top">
                          <span className="kanban-card-title">{lead.name}</span>
                          <div className="kanban-card-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setLeadModal({ open: true, lead })}
                              aria-label="Edit lead"
                              data-testid={`button-edit-lead-${lead.id}`}
                            >
                              <MessageCircle size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger-icon"
                              onClick={() =>
                                setConfirming({
                                  message: `Hapus lead "${lead.name}"?`,
                                  onConfirm: () => deleteLead.mutate({ leadId: lead.id }),
                                })
                              }
                              aria-label="Hapus lead"
                              data-testid={`button-delete-lead-${lead.id}`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <small className="table-sub">
                          {lead.clientName}
                          {lead.productName ? ` · ${lead.productName}` : ''}
                        </small>
                        <div className="crm-card-meta">
                          <span className="crm-source">{SOURCE_LABEL[lead.source] ?? lead.source}</span>
                          {lead.phone && (
                            <a
                              className="crm-phone"
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`WhatsApp ${lead.name}`}
                            >
                              <Phone size={11} /> {lead.phone}
                            </a>
                          )}
                          {lead.region && <span className="crm-region">{lead.region}</span>}
                        </div>
                        {lead.notes && <p className="kanban-card-notes">{lead.notes}</p>}
                        <div className="crm-card-footer">
                          <select
                            value={lead.category}
                            onChange={(event) =>
                              updateLead.mutate({
                                leadId: lead.id,
                                data: { category: event.target.value },
                              })
                            }
                            aria-label="Pindah kategori"
                            data-testid={`select-lead-category-${lead.id}`}
                          >
                            {(Object.keys(CATEGORY_LABEL) as CrmLeadCategory[]).map((key) => (
                              <option key={key} value={key}>
                                → {CATEGORY_LABEL[key]}
                              </option>
                            ))}
                          </select>
                          {lead.followUpAt && (
                            <span
                              className={cn(
                                'kanban-due',
                                lead.category !== 'closing' && lead.followUpAt <= today() && 'overdue',
                              )}
                            >
                              <CalendarClock size={11} /> {dateLabel(lead.followUpAt)}
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                    {grouped[category].length === 0 && (
                      <p className="crm-empty-col">Kosong</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : tab === 'klien' ? (
        <Panel className="table-panel">
          <div className="panel-head">
            <h2>Klien kampanye</h2>
            <Button variant="secondary" onClick={() => setClientModal({ open: true })} data-testid="button-add-client">
              <Plus size={14} /> Klien baru
            </Button>
          </div>
          {clients.isLoading ? (
            <State type="loading" />
          ) : !(clients.data ?? []).length ? (
            <State type="empty" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Klien</th>
                    <th>Bidang</th>
                    <th>Kontak</th>
                    <th>Produk</th>
                    <th>Leads</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(clients.data ?? []).map((client) => (
                    <tr key={client.id} data-testid={`row-crm-client-${client.id}`}>
                      <td>
                        <strong>{client.name}</strong>
                        {client.notes && <small className="table-sub">{client.notes}</small>}
                      </td>
                      <td>{client.category ?? '—'}</td>
                      <td>
                        {client.contactName ?? '—'}
                        {client.phone && <small className="table-sub">{client.phone}</small>}
                      </td>
                      <td>{client.productCount}</td>
                      <td>{client.leadCount}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn danger-icon"
                          aria-label="Hapus klien"
                          onClick={() =>
                            setConfirming({
                              message: `Hapus klien "${client.name}" beserta ${client.leadCount} leads & ${client.productCount} produknya?`,
                              onConfirm: () => deleteClient.mutate({ clientId: client.id }),
                            })
                          }
                          data-testid={`button-delete-client-${client.id}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel className="table-panel">
          <div className="panel-head">
            <h2>Produk iklan</h2>
            <Button variant="secondary" onClick={() => setProductModal({ open: true })} data-testid="button-add-product">
              <Plus size={14} /> Produk baru
            </Button>
          </div>
          {products.isLoading ? (
            <State type="loading" />
          ) : !(products.data ?? []).length ? (
            <State type="empty" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Klien</th>
                    <th>Harga referensi</th>
                    <th>Catatan</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(products.data ?? []).map((product) => (
                    <tr key={product.id} data-testid={`row-crm-product-${product.id}`}>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.clientName}</td>
                      <td>{product.price ? `Rp ${product.price.toLocaleString('id-ID')}` : '—'}</td>
                      <td>{product.notes ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn danger-icon"
                          aria-label="Hapus produk"
                          onClick={() =>
                            setConfirming({
                              message: `Hapus produk "${product.name}"?`,
                              onConfirm: () => deleteProduct.mutate({ productId: product.id }),
                            })
                          }
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {leadModal.open && (
        <LeadFormModal
          lead={leadModal.lead}
          clients={clients.data ?? []}
          products={products.data ?? []}
          onClose={() => setLeadModal({ open: false, lead: null })}
          onCreate={(data) => createLead.mutate({ data }, { onSuccess: () => setLeadModal({ open: false, lead: null }) })}
          onUpdate={(leadId, data) =>
            updateLead.mutate(
              { leadId, data },
              { onSuccess: () => setLeadModal({ open: false, lead: null }) },
            )
          }
          pending={createLead.isPending || updateLead.isPending}
        />
      )}

      {clientModal.open && (
        <ClientFormModal
          onClose={() => setClientModal({ open: false })}
          onSubmit={(data) =>
            createClient.mutate({ data }, { onSuccess: () => setClientModal({ open: false }) })
          }
          pending={createClient.isPending}
        />
      )}

      {productModal.open && (
        <ProductFormModal
          clients={clients.data ?? []}
          onClose={() => setProductModal({ open: false })}
          onSubmit={(data) =>
            createProduct.mutate({ data }, { onSuccess: () => setProductModal({ open: false }) })
          }
          pending={createProduct.isPending}
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

type LeadFormData = {
  clientId: string;
  productId: string | null;
  name: string;
  phone: string | null;
  region: string | null;
  source: string;
  category: string;
  notes: string | null;
  followUpAt: string | null;
};

function LeadFormModal({
  lead,
  clients,
  products,
  onClose,
  onCreate,
  onUpdate,
  pending,
}: {
  lead: CrmLeadRow | null;
  clients: Array<{ id: string; name: string }>;
  products: Array<{ id: string; clientId: string; name: string }>;
  onClose: () => void;
  onCreate: (data: LeadFormData) => void;
  onUpdate: (leadId: string, data: Partial<LeadFormData>) => void;
  pending: boolean;
}) {
  const [clientId, setClientId] = useState(lead?.clientId ?? clients[0]?.id ?? '');
  const [productId, setProductId] = useState(lead?.productId ?? '');
  const [name, setName] = useState(lead?.name ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [region, setRegion] = useState(lead?.region ?? '');
  const [source, setSource] = useState(lead?.source ?? 'meta');
  const [category, setCategory] = useState<string>(lead?.category ?? 'follow_up');
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [followUpAt, setFollowUpAt] = useState(lead?.followUpAt ?? '');

  const clientProducts = products.filter((product) => product.clientId === clientId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      clientId,
      productId: productId || null,
      name: name.trim(),
      phone: phone.trim() || null,
      region: region.trim() || null,
      source,
      category,
      notes: notes.trim() || null,
      followUpAt: followUpAt || null,
    };
    if (lead) {
      const { clientId: _ignored, ...rest } = data;
      onUpdate(lead.id, rest);
    } else {
      onCreate(data);
    }
  };

  return (
    <Modal title={lead ? 'Edit lead' : 'Lead baru'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Klien" hint="Pemilik kampanye / produk ini.">
          <select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setProductId('');
            }}
            required
            data-testid="select-lead-client"
          >
            <option value="" disabled>
              Pilih klien
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Produk" hint="Opsional — produk yang ditawarkan.">
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">— tanpa produk —</option>
            {clientProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nama lead">
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} data-testid="input-lead-name" />
        </Field>
        <Field label="No. HP / WhatsApp" hint="Dipakai untuk tombol chat cepat.">
          <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
        </Field>
        <Field label="Daerah">
          <input value={region} onChange={(event) => setRegion(event.target.value)} />
        </Field>
        <Field label="Sumber">
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            {Object.entries(SOURCE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kategori">
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {(Object.keys(CATEGORY_LABEL) as CrmLeadCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Follow-up berikutnya" hint="Kosongkan kalau belum dijadwalkan.">
          <input type="date" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} />
        </Field>
        <Field label="Catatan" hint="Riwayat chat, permintaan khusus, dll.">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending || !clientId} data-testid="button-submit-lead">
            {pending ? 'Menyimpan…' : lead ? 'Simpan perubahan' : 'Tambah lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ClientFormModal({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      category: category.trim() || null,
      contactName: contactName.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal title="Klien baru" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Nama klien" hint="Nama brand / pemilik kampanye.">
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} data-testid="input-client-name" />
        </Field>
        <Field label="Bidang usaha" hint="Contoh: konveksi, kafe, freelancer.">
          <input value={category} onChange={(event) => setCategory(event.target.value)} />
        </Field>
        <Field label="Nama kontak">
          <input value={contactName} onChange={(event) => setContactName(event.target.value)} />
        </Field>
        <Field label="No. HP">
          <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
        </Field>
        <Field label="Catatan">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending} data-testid="button-submit-client">
            {pending ? 'Menyimpan…' : 'Tambah klien'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ProductFormModal({
  clients,
  onClose,
  onSubmit,
  pending,
}: {
  clients: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      clientId,
      name: name.trim(),
      price: Number(price || 0),
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal title="Produk iklan baru" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Klien">
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} required>
            <option value="" disabled>
              Pilih klien
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nama produk">
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} data-testid="input-product-name" />
        </Field>
        <Field label="Harga referensi" hint="Untuk hitung closing; 0 = belum ditentukan.">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="numeric"
          />
        </Field>
        <Field label="Catatan">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending || !clientId} data-testid="button-submit-product">
            {pending ? 'Menyimpan…' : 'Tambah produk'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
