'use client';

import { useState, type FormEvent } from 'react';
import { MessageCircle, Pencil, Plus, Power, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImage, useCreateSupplier, useDeleteSupplier, useListSuppliers, useUpdateSupplier } from '@/lib/api/hooks';
import type { Supplier } from '@/lib/api/types';
import { Badge, Button, Field, ImagePreviewButton, Modal, Panel, PageTitle, Pagination, State } from '@/components/ui';
import { money, number, waLink } from '@/lib/format';

const PAGE_SIZE = 10;

export default function SuppliersPage() {
  const suppliers = useListSuppliers();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [page, setPage] = useState(1);
  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const createSupplier = useCreateSupplier({ onSuccess: close });
  const updateSupplier = useUpdateSupplier({ onSuccess: close });
  const deleteSupplier = useDeleteSupplier();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const imageFile = form.get('image');
    let imageUrl = editing?.imageUrl ?? null;
    try {
      if (imageFile instanceof File && imageFile.size > 0) {
        imageUrl = (await uploadImage(imageFile, 'supplier')).url;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload foto gagal.');
      return;
    }
    const data = {
      name: String(form.get('name')),
      whatsapp: String(form.get('whatsapp') || '') || null,
      category: String(form.get('category') || '') || null,
      city: String(form.get('city') || '') || null,
      imageUrl,
      isActive: editing ? editing.isActive : true,
    };
    if (editing) updateSupplier.mutate({ supplierId: editing.id, data });
    else createSupplier.mutate({ data });
  };

  const toggleActive = (supplier: Supplier) =>
    updateSupplier.mutate({ supplierId: supplier.id, data: { isActive: !supplier.isActive } });

  const rows = suppliers.data ?? [];

  return (
    <>
      <PageTitle
        eyebrow="OPERASIONAL / SUPLIER"
        title="Daftar suplier."
        description="Kontak, kategori, dan daerah semua suplier—siap dihubungi lewat WhatsApp."
        action={
        <Button onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}>
            <Plus size={16} /> Tambah suplier
          </Button>
        }
      />

       <Panel className="supplier-panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">SEMUA SUPLIER · {number(rows.length)}</div>
            <h2>Suplier terdaftar</h2>
          </div>
          <Truck size={18} className="muted" />
        </div>

         {suppliers.isLoading ? (
           <div className="supplier-state"><State type="loading" /></div>
         ) : suppliers.isError ? (
           <div className="supplier-state"><State type="error" onRetry={() => suppliers.refetch()} /></div>
         ) : !rows.length ? (
           <div className="supplier-state"><State type="empty" /></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nama suplier</th>
                  <th>Foto</th>
                  <th>WhatsApp</th>
                  <th>Kategori</th>
                  <th>Daerah</th>
                  <th>Produk / penjualan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((supplier) => {
                  const link = waLink(supplier.whatsapp);
                  return (
                    <tr key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                      <td>
                        <strong>{supplier.name}</strong>
                        {!supplier.isActive && (
                          <>
                            {' '}
                            <Badge tone="neutral">Nonaktif</Badge>
                          </>
                        )}
                      </td>
                      <td><ImagePreviewButton src={supplier.imageUrl} alt={`Foto ${supplier.name}`} /></td>
                      <td>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mini-action"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            data-testid={`link-whatsapp-${supplier.id}`}
                          >
                            <MessageCircle size={14} /> {supplier.whatsapp}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{supplier.category || <span className="muted">—</span>}</td>
                      <td>{supplier.city || <span className="muted">—</span>}</td>
                      <td>
                        {supplier.products?.length ? (
                          <div className="supplier-product-list">
                            {supplier.products.map((product) => (
                              <div className="supplier-product" key={product.id}>
                                {product.imageUrl ? (
                                   <ImagePreviewButton
                                     src={product.imageUrl}
                                     alt={`Foto ${product.name}`}
                                     size="small"
                                   />
                                ) : (
                                  <span className="product-thumb product-thumb-empty">—</span>
                                )}
                                <span className="supplier-product-copy">
                                  <strong>{product.name}</strong>
                                  <small>
                                    {number(product.totalSold)} pcs · {money(product.revenue)}
                                  </small>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Belum ada produk</span>
                        )}
                      </td>
                      <td>
                        <div className="button-pair table-actions">
                          <button
                            className="icon-btn"
                            onClick={() => toggleActive(supplier)}
                            aria-label={supplier.isActive ? 'Nonaktifkan suplier' : 'Aktifkan suplier'}
                            title={supplier.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            data-testid={`button-toggle-supplier-${supplier.id}`}
                          >
                            <Power size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setEditing(supplier);
                              setModalOpen(true);
                            }}
                            aria-label="Edit suplier"
                            data-testid={`button-edit-supplier-${supplier.id}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn danger-icon"
                            onClick={() => {
                              if (window.confirm(`Hapus suplier "${supplier.name}"?`)) {
                                deleteSupplier.mutate({ supplierId: supplier.id });
                              }
                            }}
                            aria-label="Hapus suplier"
                            data-testid={`button-delete-supplier-${supplier.id}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!suppliers.isLoading && !suppliers.isError && rows.length > 0 && (
          <Pagination
            page={page}
            totalPages={Math.ceil(rows.length / PAGE_SIZE)}
            onPageChange={setPage}
          />
        )}
      </Panel>

      {modalOpen && (
        <Modal title={`${editing ? 'Edit' : 'Tambah'} suplier`} onClose={close}>
          <form className="form-grid" onSubmit={submit}>
            <Field label="Nama suplier">
              <input
                name="name"
                defaultValue={editing?.name}
                required
                data-testid="input-supplier-name"
              />
            </Field>
            <Field label="No. WhatsApp" hint="Contoh: 08123456789 — otomatis jadi link chat.">
              <input
                name="whatsapp"
                defaultValue={editing?.whatsapp ?? ''}
                placeholder="08123456789"
                data-testid="input-supplier-whatsapp"
              />
            </Field>
            <Field label="Kategori" hint="Contoh: Bahan baku, Kemasan, Percetakan.">
              <input
                name="category"
                defaultValue={editing?.category ?? ''}
                data-testid="input-supplier-category"
              />
            </Field>
            <Field label="Daerah">
              <input
                name="city"
                defaultValue={editing?.city ?? ''}
                data-testid="input-supplier-city"
              />
            </Field>
            <Field label="Foto suplier" hint="JPG, PNG, atau WebP.">
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                data-testid="input-supplier-image"
              />
              {editing?.imageUrl && (
                <ImagePreviewButton src={editing.imageUrl} alt={`Foto ${editing.name}`} />
              )}
            </Field>
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
