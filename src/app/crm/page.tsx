'use client';

/**
 * CRM — halaman utama: pipeline leads (papan hot/warm/closing/follow-up).
 * Klien & produk pindah ke /crm/klien, jadwal follow-up ke /crm/follow-up —
 * polanya sama seperti KEUANGAN yang memisah Settlement dan Invoice.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, Phone, Plus } from 'lucide-react';
import {
  useCreateCrmLead,
  useDeleteCrmLead,
  useListCrmClients,
  useListCrmLeads,
  useListCrmProducts,
  useUpdateCrmLead,
} from '@/lib/api/hooks';
import type { CrmLeadCategory, CrmLeadRow } from '@/lib/api/types';
import { Badge, Button, ConfirmDialog, PageTitle, Panel, State, type ConfirmRequest } from '@/components/ui';
import { cn, dateLabel, today } from '@/lib/format';
import {
  CATEGORY_LABEL,
  CATEGORY_TONE,
  CRM_CATEGORIES,
  CRM_SUB_PAGES,
  LeadFormModal,
  SOURCE_LABEL,
} from './_shared';

export default function CrmPipelinePage() {
  const pathname = usePathname();
  const [filterClient, setFilterClient] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  const [leadModal, setLeadModal] = useState<{ open: boolean; lead: CrmLeadRow | null }>({
    open: false,
    lead: null,
  });

  const clients = useListCrmClients();
  const products = useListCrmProducts({});
  const leads = useListCrmLeads({
    clientId: filterClient || undefined,
    source: filterSource || undefined,
    search: search || undefined,
  });

  const createLead = useCreateCrmLead();
  const updateLead = useUpdateCrmLead();
  const deleteLead = useDeleteCrmLead();

  const rows = useMemo(() => leads.data?.leads ?? [], [leads.data]);
  const counts = leads.data?.counts;

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
      lead.category !== 'closing' && (!lead.followUpAt || lead.followUpAt <= today()),
  ).length;

  const closeLeadModal = () => setLeadModal({ open: false, lead: null });

  return (
    <>
      <PageTitle
        eyebrow="CRM / PIPELINE"
        title="Calon pembeli, terkelola."
        description="Pipeline per klien & produk: hot, warm, closing, follow-up. Semua hasil iklan masuk ke satu papan."
        action={
          <Button onClick={() => setLeadModal({ open: true, lead: null })} data-testid="button-add-lead">
            <Plus size={16} /> Tambah lead
          </Button>
        }
      />

      <div className="pill-row pill-row-sub" role="navigation" aria-label="Sub-halaman CRM">
        {CRM_SUB_PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className={cn('pill pill-sm', pathname === page.href && 'active')}
          >
            {page.label}
          </Link>
        ))}
      </div>

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
      </div>

      {leads.isLoading ? (
        <State type="loading" />
      ) : leads.isError ? (
        <State type="error" onRetry={() => leads.refetch()} />
      ) : (
        <>
          {counts && (
            <div className="crm-chips">
              {CRM_CATEGORIES.map((key) => (
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
            <Panel className="table-panel">
              <State type="empty" />
            </Panel>
          ) : (
            <div className="crm-board" data-testid="crm-board">
              {CRM_CATEGORIES.map((category) => (
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
                              <Phone size={13} />
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
                            {CRM_CATEGORIES.map((key) => (
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
                    {grouped[category].length === 0 && <p className="crm-empty-col">Kosong</p>}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {leadModal.open && (
        <LeadFormModal
          lead={leadModal.lead}
          clients={clients.data ?? []}
          products={products.data ?? []}
          onClose={closeLeadModal}
          onCreate={(data) => createLead.mutate({ data }, { onSuccess: closeLeadModal })}
          onUpdate={(leadId, data) =>
            updateLead.mutate({ leadId, data }, { onSuccess: closeLeadModal })
          }
          pending={createLead.isPending || updateLead.isPending}
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
