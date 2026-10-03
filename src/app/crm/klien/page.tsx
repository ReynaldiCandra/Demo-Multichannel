'use client';

/**
 * CRM — klien kampanye & produk iklan. Dipisah dari pipeline supaya tiap
 * halaman punya satu tugas (pola yang sama dengan Settlement vs Invoice).
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  useBulkDeleteCrmClients,
  useBulkDeleteCrmProducts,
  useCreateCrmClient,
  useCreateCrmProduct,
  useDeleteCrmClient,
  useDeleteCrmProduct,
  useListCrmClients,
  useListCrmProducts,
} from '@/lib/api/hooks';
import { Button, ConfirmDialog, PageTitle, Panel, State, type ConfirmRequest } from '@/components/ui';
import { BulkBar, BulkCheckbox, useBulkSelection } from '@/components/bulk-selection';
import { cn, money } from '@/lib/format';
import { ClientFormModal, CRM_SUB_PAGES, ProductFormModal } from '../_shared';

export default function CrmClientsPage() {
  const pathname = usePathname();
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  const [clientModal, setClientModal] = useState(false);
  const [productModal, setProductModal] = useState(false);

  const clients = useListCrmClients();
  const products = useListCrmProducts({});

  const createClient = useCreateCrmClient();
  const deleteClient = useDeleteCrmClient();
  const createProduct = useCreateCrmProduct();
  const deleteProduct = useDeleteCrmProduct();
  const bulkDeleteClients = useBulkDeleteCrmClients();
  const bulkDeleteProducts = useBulkDeleteCrmProducts();

  // Seleksi terpisah untuk tabel klien dan tabel produk (dua panel berdampingan).
  const clientBulk = useBulkSelection();
  const clientRows = useMemo(() => clients.data ?? [], [clients.data]);
  const clientIds = useMemo(() => clientRows.map((row) => row.id), [clientRows]);
  useEffect(() => {
    clientBulk.prune(clientIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientIds]);
  const selectedClientIds = useMemo(() => [...clientBulk.selected], [clientBulk.selected]);

  const productBulk = useBulkSelection();
  const productRows = useMemo(() => products.data ?? [], [products.data]);
  const productIds = useMemo(() => productRows.map((row) => row.id), [productRows]);
  useEffect(() => {
    productBulk.prune(productIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds]);
  const selectedProductIds = useMemo(() => [...productBulk.selected], [productBulk.selected]);

  const bulkDeleteClientsSelected = () =>
    setConfirming({
      message: `Hapus ${selectedClientIds.length} klien terpilih beserta semua leads & produknya? Tindakan ini tidak bisa dibatalkan.`,
      onConfirm: () => {
        bulkDeleteClients.mutate({ ids: selectedClientIds }, { onSuccess: () => clientBulk.clear() });
      },
    });

  const bulkDeleteProductsSelected = () =>
    setConfirming({
      message: `Hapus ${selectedProductIds.length} produk iklan terpilih?`,
      onConfirm: () => {
        bulkDeleteProducts.mutate({ ids: selectedProductIds }, { onSuccess: () => productBulk.clear() });
      },
    });

  return (
    <>
      <PageTitle
        eyebrow="CRM / KLIEN & PRODUK"
        title="Master data kampanye."
        description="Klien pemilik kampanye dan produk iklannya — dipakai pipeline leads untuk mengelompokkan calon pembeli."
        action={
          <div className="button-pair">
            <Button variant="secondary" onClick={() => setProductModal(true)} data-testid="button-add-product">
              <Plus size={15} /> Produk
            </Button>
            <Button onClick={() => setClientModal(true)} data-testid="button-add-client">
              <Plus size={16} /> Klien
            </Button>
          </div>
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

      <div className="detail-grid">
        <Panel className="table-panel">
          <div className="panel-head">
            <h2>Klien kampanye</h2>
            <span className="mono muted">{clients.data?.length ?? 0} klien</span>
          </div>
          {clients.isLoading ? (
            <State type="loading" />
          ) : !clientRows.length ? (
            <State type="empty" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="bulk-col">
                      <BulkCheckbox
                        checked={clientBulk.allSelected(clientIds)}
                        onChange={() => clientBulk.toggleAll(clientIds)}
                        label="Pilih semua klien"
                      />
                    </th>
                    <th>Klien</th>
                    <th>Bidang</th>
                    <th>Kontak</th>
                    <th className="right">Produk</th>
                    <th className="right">Leads</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {clientRows.map((client) => (
                    <tr
                      key={client.id}
                      className={clientBulk.isSelected(client.id) ? 'bulk-row-selected' : undefined}
                      data-testid={`row-crm-client-${client.id}`}
                    >
                      <td className="bulk-col">
                        <BulkCheckbox
                          checked={clientBulk.isSelected(client.id)}
                          onChange={() => clientBulk.toggle(client.id)}
                          label={`Pilih klien ${client.name}`}
                        />
                      </td>
                      <td>
                        <strong>{client.name}</strong>
                        {client.notes && <small className="table-sub">{client.notes}</small>}
                      </td>
                      <td>{client.category ?? '—'}</td>
                      <td>
                        {client.contactName ?? '—'}
                        {client.phone && <small className="table-sub">{client.phone}</small>}
                      </td>
                      <td className="mono right">{client.productCount}</td>
                      <td className="mono right">{client.leadCount}</td>
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

        <Panel className="table-panel">
          <div className="panel-head">
            <h2>Produk iklan</h2>
            <span className="mono muted">{products.data?.length ?? 0} produk</span>
          </div>
          {products.isLoading ? (
            <State type="loading" />
          ) : !productRows.length ? (
            <State type="empty" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="bulk-col">
                      <BulkCheckbox
                        checked={productBulk.allSelected(productIds)}
                        onChange={() => productBulk.toggleAll(productIds)}
                        label="Pilih semua produk"
                      />
                    </th>
                    <th>Produk</th>
                    <th>Klien</th>
                    <th className="right">Harga referensi</th>
                    <th>Catatan</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((product) => (
                    <tr
                      key={product.id}
                      className={productBulk.isSelected(product.id) ? 'bulk-row-selected' : undefined}
                      data-testid={`row-crm-product-${product.id}`}
                    >
                      <td className="bulk-col">
                        <BulkCheckbox
                          checked={productBulk.isSelected(product.id)}
                          onChange={() => productBulk.toggle(product.id)}
                          label={`Pilih produk ${product.name}`}
                        />
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.clientName}</td>
                      <td className="mono right">
                        {product.price ? money(product.price) : '—'}
                      </td>
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
      </div>

      {clientModal && (
        <ClientFormModal
          onClose={() => setClientModal(false)}
          onSubmit={(data) =>
            createClient.mutate({ data }, { onSuccess: () => setClientModal(false) })
          }
          pending={createClient.isPending}
        />
      )}

      {productModal && (
        <ProductFormModal
          clients={clients.data ?? []}
          onClose={() => setProductModal(false)}
          onSubmit={(data) =>
            createProduct.mutate({ data }, { onSuccess: () => setProductModal(false) })
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

      <BulkBar
        count={clientBulk.count}
        label="klien"
        onClear={() => clientBulk.clear()}
        onDelete={bulkDeleteClientsSelected}
      />

      <BulkBar
        count={productBulk.count}
        label="produk iklan"
        onClear={() => productBulk.clear()}
        onDelete={bulkDeleteProductsSelected}
        deleteLabel="Hapus produk terpilih"
      />
    </>
  );
}
