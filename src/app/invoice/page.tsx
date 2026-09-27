'use client';

import { ReceiptText } from 'lucide-react';
import { Panel, PageTitle } from '@/components/ui';

export default function InvoicePage() {
  return (
    <>
      <PageTitle
        eyebrow="INVOICE"
        title="Invoice belum tersedia."
        description="Menu ini sekarang punya rute sendiri, terpisah dari Freelance Ads / Kanban. Pembuatan invoice (custom CRUD: logo, scope kerja, item, total, deskripsi) dan export PDF akan dibangun di tahap berikutnya."
      />

      <Panel className="table-panel">
        <div className="state">
          <ReceiptText size={24} />
          <strong>Modul sedang dibangun</strong>
          <span>
            Rencana: form invoice dengan field custom (logo, scope kerja, daftar item, total,
            deskripsi, dll), daftar invoice yang bisa dikelola, dan export ke PDF.
          </span>
        </div>
      </Panel>
    </>
  );
}
