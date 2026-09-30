'use client';

/**
 * Bagian bersama modul CRM: label kategori/sumber + form modal untuk lead,
 * klien, dan produk. Dipakai halaman /crm (pipeline), /crm/klien, dan
 * /crm/follow-up supaya ketiganya punya form & istilah yang konsisten.
 */

import { useState, type FormEvent } from 'react';
import type { CrmLeadCategory, CrmLeadRow } from '@/lib/api/types';
import { Button, Field, Modal } from '@/components/ui';

export const CATEGORY_LABEL: Record<CrmLeadCategory, string> = {
  hot: 'Hot',
  warm: 'Warm',
  closing: 'Closing',
  follow_up: 'Follow-up',
};

export const CATEGORY_TONE: Record<CrmLeadCategory, 'danger' | 'yellow' | 'good' | 'neutral'> = {
  hot: 'danger',
  warm: 'yellow',
  closing: 'good',
  follow_up: 'neutral',
};

export const SOURCE_LABEL: Record<string, string> = {
  meta: 'Meta Ads',
  google: 'Google',
  shopee_ads: 'Shopee Ads',
  tiktok_ads: 'TikTok Ads',
  organik: 'Organik',
  lainnya: 'Lainnya',
};

export const CRM_CATEGORIES = Object.keys(CATEGORY_LABEL) as CrmLeadCategory[];

export type LeadFormData = {
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

export function LeadFormModal({
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
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            data-testid="input-lead-name"
          />
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
            {CRM_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Follow-up berikutnya" hint="Kosongkan kalau belum dijadwalkan.">
          <input
            type="date"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
          />
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

export function ClientFormModal({
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
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            data-testid="input-client-name"
          />
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

export function ProductFormModal({
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
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            required
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
        <Field label="Nama produk">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={160}
            data-testid="input-product-name"
          />
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

/** Navigasi antar-halaman CRM, mengikuti pola sub-menu (pills). */
export const CRM_SUB_PAGES = [
  { href: '/crm', label: 'Pipeline' },
  { href: '/crm/klien', label: 'Klien & Produk' },
  { href: '/crm/follow-up', label: 'Follow-up' },
] as const;
