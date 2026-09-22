import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="panel settings-placeholder">
      <div className="eyebrow">404</div>
      <h2>Halaman tidak ditemukan</h2>
      <p>Alamat yang kamu buka tidak ada di workspace ini.</p>
      <Link href="/" className="text-link">
        Kembali ke dashboard
      </Link>
    </section>
  );
}
