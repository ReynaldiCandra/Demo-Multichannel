'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Boxes, CircleDollarSign, MessageCircle, Package, Receipt, Search, ShoppingBag } from 'lucide-react';
import { useGetSupplier } from '@/lib/api/hooks';
import { Badge, ImagePreviewButton, KpiCard, PageTitle, Panel, Pagination, State } from '@/components/ui';
import { cn, money, number, waLink } from '@/lib/format';

const PAGE_SIZE = 10;

type ProductSort = 'sold' | 'revenue' | 'name';

const SORTS: Array<{ key: ProductSort; label: string }> = [
  { key: 'sold', label: 'Terlaris (pcs)' },
  { key: 'revenue', label: 'Omzet' },
  { key: 'name', label: 'Nama A–Z' },
];

/**
 * Halaman detail suplier.
 *
 * Daftar suplier (/suppliers) hanya menampilkan ringkasan + beberapa produk
 * terlaris, karena satu suplier bisa punya puluhan produk. Halaman ini yang
 * membuka seluruh produknya — satu suplier per request, lengkap dengan
 * pencarian, urutan, dan pagination.
 */
export default function SupplierDetailPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params?.supplierId ?? '';

  const query = useGetSupplier(supplierId);
  const [sort, setSort] = useState<ProductSort>('sold');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const supplier = query.data;
  const allProducts = supplier?.products;

  const products = useMemo(() => {
    const rows = allProducts ?? [];
    const term = search.trim().toLowerCase();
    const filtered = term ? rows.filter((product) => product.name.toLowerCase().includes(term)) : rows;
    return [...filtered].sort((a, b) => {
      if (sort === 'revenue') return b.revenue - a.revenue || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.totalSold - a.totalSold || a.name.localeCompare(b.name);
    });
  }, [allProducts, search, sort]);

  if (query.isLoading) return <State type="loading" />;
  if (query.isError || !supplier) return <State type="error" onRetry={() => query.refetch()} />;

  const link = waLink(supplier.whatsapp);
  const rows = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const topRevenue = Math.max(...products.map((product) => product.revenue), 1);
  const sortLabel = SORTS.find((item) => item.key === sort)?.label.toLowerCase();

  return (
    <>
      <Link href="/suppliers" className="back-link" data-testid="link-back-suppliers">
        ← Kembali ke daftar suplier
      </Link>

      <PageTitle
        eyebrow="OPERASIONAL / SUPLIER"
        title={supplier.name}
        description={[supplier.category, supplier.city].filter(Boolean).join(' · ') || 'Kontak dan produk suplier ini.'}
        action={
          <div className="button-pair">
            <Badge tone={supplier.isActive ? 'good' : 'neutral'}>
              {supplier.isActive ? 'Aktif' : 'Nonaktif'}
            </Badge>
            <Link
              href={`/pos/produk?supplierId=${supplier.id}`}
              className="btn btn-secondary"
              data-testid="link-supplier-master-products"
            >
              <Package size={15} /> Daftar produk
            </Link>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                data-testid="link-supplier-whatsapp"
              >
                <MessageCircle size={15} /> {supplier.whatsapp}
              </a>
            )}
          </div>
        }
      />

      <div className="kpi-grid kpi-grid-compact">
        <KpiCard
          label="Produk"
          value={number(supplier.productCount)}
          meta="produk milik suplier ini"
          accent="navy"
          icon={Boxes}
        />
        <KpiCard
          label="Pcs terjual"
          value={number(supplier.totalSold)}
          meta="dari transaksi selesai"
          accent="teal"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Omzet"
          value={money(supplier.revenue)}
          meta="harga × qty − diskon"
          accent="yellow"
          icon={CircleDollarSign}
        />
        <KpiCard
          label="Transaksi"
          value={number(supplier.transactionCount)}
          meta="jumlah input penjualan"
          accent="orange"
          icon={Receipt}
        />
      </div>

      <Panel className="table-panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">SEMUA PRODUK · {number(supplier.productCount)}</div>
            <h2>Produk yang dipasok</h2>
            <p className="section-caption">
              {number(products.length)} produk · urut {sortLabel}
            </p>
          </div>
          <label className="search-box">
            <Search size={14} />
            <input
              type="search"
              placeholder="Cari produk…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              data-testid="input-supplier-product-search"
            />
          </label>
        </div>

        <div className="tabs tabs-sort">
          {SORTS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={cn('tab', sort === item.key && 'active')}
              onClick={() => {
                setSort(item.key);
                setPage(1);
              }}
              data-testid={`tab-supplier-sort-${item.key}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!supplier.productCount ? (
          <State type="empty" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produk</th>
                  <th className="right">Pcs</th>
                  <th className="right">Omzet</th>
                  <th className="right">Transaksi</th>
                  <th>Porsi omzet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product, index) => (
                  <tr key={product.id} data-testid={`row-supplier-product-${product.id}`}>
                    <td className="mono muted">
                      {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
                    </td>
                    <td>
                      <div className="store-name-cell">
                        {product.imageUrl ? (
                          <ImagePreviewButton
                            src={product.imageUrl}
                            alt={`Foto ${product.name}`}
                            size="small"
                          />
                        ) : (
                          <span className="product-thumb product-thumb-small product-thumb-empty">—</span>
                        )}
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td className="right mono">{number(product.totalSold)}</td>
                    <td className="right mono">{money(product.revenue)}</td>
                    <td className="right mono">{number(product.transactionCount)}</td>
                    <td>
                      <div className="share-cell">
                        <div className="performance-bar">
                          <span
                            style={{
                              width: `${Math.max(4, (product.revenue / topRevenue) * 100)}%`,
                            }}
                          />
                        </div>
                        <small className="mono">
                          {supplier.revenue > 0
                            ? Math.round((product.revenue / supplier.revenue) * 100)
                            : 0}
                          %
                        </small>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Tidak ada produk yang cocok dengan “{search}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={Math.ceil(products.length / PAGE_SIZE)}
          onPageChange={setPage}
        />
      </Panel>
    </>
  );
}
