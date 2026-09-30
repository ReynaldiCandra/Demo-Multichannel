'use client';

/**
 * CRM — daftar follow-up: lead yang belum closing dan (belum) punya jadwal,
 * atau jadwalnya sudah lewat/hari ini. Sumber lead = satu query CRM leads,
 * difilter di klien supaya API tetap sederhana.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, Handshake, Phone } from 'lucide-react';
import {
  useListCrmClients,
  useListCrmLeads,
  useListCrmProducts,
  useUpdateCrmLead,
} from '@/lib/api/hooks';
import type { CrmLeadRow } from '@/lib/api/types';
import { Badge, PageTitle, Panel, State } from '@/components/ui';
import { cn, dateLabel, today, waLink } from '@/lib/format';
import { CATEGORY_LABEL, CRM_SUB_PAGES, LeadFormModal, SOURCE_LABEL } from '../_shared';

export default function CrmFollowUpPage() {
  const pathname = usePathname();
  const [editing, setEditing] = useState<CrmLeadRow | null>(null);

  const clients = useListCrmClients();
  const products = useListCrmProducts({});
  const leads = useListCrmLeads({});
  const updateLead = useUpdateCrmLead();

  const rows = useMemo(() => leads.data?.leads ?? [], [leads.data]);

  const pending = useMemo(
    () =>
      rows
        .filter(
          (lead) =>
            lead.category !== 'closing' && (!lead.followUpAt || lead.followUpAt <= today()),
        )
        // Yang sudah lewat paling atas, tanpa jadwal paling bawah.
        .sort((a, b) => (a.followUpAt ?? '9999').localeCompare(b.followUpAt ?? '9999')),
    [rows],
  );

  const overdueCount = pending.filter((lead) => lead.followUpAt && lead.followUpAt < today()).length;

  const markClosing = (lead: CrmLeadRow) =>
    updateLead.mutate({ leadId: lead.id, data: { category: 'closing' } });

  return (
    <>
      <PageTitle
        eyebrow="CRM / FOLLOW-UP"
        title="Jangan ada lead yang terlupakan."
        description="Semua lead yang belum closing dan jadwal follow-up-nya hari ini atau sudah lewat."
        action={
          <Badge tone={overdueCount ? 'danger' : 'good'}>
            <CalendarClock size={11} /> {overdueCount} terlambat
          </Badge>
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

      <Panel className="table-panel">
        <div className="panel-head">
          <h2>Perlu follow-up</h2>
          <span className="mono muted">{pending.length} lead</span>
        </div>
        {leads.isLoading ? (
          <State type="loading" />
        ) : leads.isError ? (
          <State type="error" onRetry={() => leads.refetch()} />
        ) : !pending.length ? (
          <State type="empty" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Klien / produk</th>
                  <th>Sumber</th>
                  <th>Kontak</th>
                  <th>Jadwal</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((lead) => (
                  <tr key={lead.id} data-testid={`row-followup-${lead.id}`}>
                    <td>
                      <strong>{lead.name}</strong>
                      {lead.region && <small className="table-sub">{lead.region}</small>}
                    </td>
                    <td>
                      {lead.clientName}
                      {lead.productName && (
                        <small className="table-sub">{lead.productName}</small>
                      )}
                    </td>
                    <td>
                      <Badge tone="neutral">{SOURCE_LABEL[lead.source] ?? lead.source}</Badge>
                    </td>
                    <td>
                      {waLink(lead.phone) ? (
                        <a
                          className="crm-phone"
                          href={waLink(lead.phone) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          title={`WhatsApp ${lead.name}`}
                        >
                          <Phone size={11} /> {lead.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {lead.followUpAt ? (
                        <span
                          className={cn(
                            'kanban-due',
                            lead.followUpAt < today() && 'overdue',
                          )}
                        >
                          <CalendarClock size={11} /> {dateLabel(lead.followUpAt)}
                        </span>
                      ) : (
                        <span className="muted">Belum dijadwalkan</span>
                      )}
                      <small className="table-sub">{CATEGORY_LABEL[lead.category]}</small>
                    </td>
                    <td>
                      <div className="button-pair table-actions">
                        <button
                          type="button"
                          className="mini-action"
                          onClick={() => markClosing(lead)}
                          disabled={updateLead.isPending}
                          title="Tandai closing supaya keluar dari daftar"
                          data-testid={`button-close-followup-${lead.id}`}
                        >
                          <Handshake size={11} /> Closing
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setEditing(lead)}
                          aria-label="Edit lead"
                          data-testid={`button-edit-followup-${lead.id}`}
                        >
                          <Phone size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && (
        <LeadFormModal
          lead={editing}
          clients={clients.data ?? []}
          products={products.data ?? []}
          onClose={() => setEditing(null)}
          onCreate={() => setEditing(null)}
          onUpdate={(leadId, data) =>
            updateLead.mutate(
              { leadId, data },
              { onSuccess: () => setEditing(null) },
            )
          }
          pending={updateLead.isPending}
        />
      )}
    </>
  );
}
