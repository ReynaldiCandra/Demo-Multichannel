'use client';

import Link from 'next/link';
import {
  Badge,
  CircleUserRound,
  ChevronRight,
  ImageUp,
  Settings2,
  UsersRound,
} from 'lucide-react';
import { PageTitle, Panel } from '@/components/ui';
import { useSession } from '@/lib/api/hooks';

function SettingsIdentity() {
  const session = useSession();

  return (
    <div className="identity-card">
      <div className="identity-avatar">
        {session.data?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.data.imageUrl} alt="foto profil" />
        ) : (
          <CircleUserRound size={20} className="identity-icon" />
        )}
      </div>
      <div className="identity-body">
        <p className="identity-eyebrow">Akun Anda</p>
        <h1>{session.data?.name ?? 'Memuat…'}</h1>
        <p className="identity-text">
          {session.data?.email ?? '—'} ·{' '}
          {session.data?.role === 'demo'
            ? 'Mode demo — hanya melihat'
            : session.data?.role === 'owner'
              ? 'Owner — akses penuh ke semua pengaturan'
              : 'Pengguna — kelola data tanpa Pengaturan'}
        </p>
      </div>
      <Link href="/pengaturan/profil" className="identity-link">
        <span className="identity-link-title">Edit profil</span>
        <ChevronRight size={15} />
      </Link>
    </div>
  );
}

function SettingsNavCards() {
  const session = useSession();
  return (
    <div className="settings-nav">
      {NAV_CARDS.map((card) => {
        const Icon = card.icon;
        const locked = card.ownerOnly && session.data?.role !== 'owner';
        return (
          <Link
            key={card.href}
            href={card.href}
            className="settings-nav-card"
            data-testid={`link-settings-${card.href.split('/').pop()}`}
          >
            <span className="settings-nav-icon">
              <Icon size={18} />
            </span>
            <span className="settings-nav-copy">
              <strong>
                {card.title}
                {locked && <span className="badge badge-neutral">Owner</span>}
              </strong>
              <span>{card.description}</span>
              <em className="settings-nav-access">{card.access}</em>
            </span>
            <ChevronRight size={15} className="settings-nav-chevron" />
          </Link>
        );
      })}
    </div>
  );
}

const NAV_CARDS = [
  {
    href: '/pengaturan/profil',
    icon: CircleUserRound,
    title: 'Profil & keamanan',
    description: 'Foto, nama, dan ganti password akun kamu sendiri.',
    access: 'Semua pengguna',
    ownerOnly: false,
  },
  {
    href: '/pengaturan/logo-kanal',
    icon: ImageUp,
    title: 'Logo kanal',
    description: 'Logo Shopee, TikTok Shop, Lazada, dll. — tampil di seluruh aplikasi.',
    access: 'Semua pengguna',
    ownerOnly: false,
  },
  {
    href: '/pengaturan/pengguna',
    icon: UsersRound,
    title: 'Pengguna workspace',
    description: 'Daftar staf & tambah user baru dengan role yang jelas.',
    access: 'Owner',
    ownerOnly: true,
  },
  {
    href: '/pengaturan/modul',
    icon: Settings2,
    title: 'Modul',
    description: 'Nyalakan/matikan bagian aplikasi — data tetap aman.',
    access: 'Owner',
    ownerOnly: true,
  },
] as const;


/**
 * Hub Pengaturan. Semua use case punya sub-halaman sendiri
 * (Profil, Logo kanal, Pengguna, Modul) supaya UI tidak menumpuk
 * banyak form acak di satu layar — sesuai alur aplikasi umumnya.
 */
export default function SettingsPage() {
  return (
    <>
      <PageTitle
        eyebrow="PENGATURAN"
        title="Ruang kendali."
        description="Pilih bagian yang mau diatur. Semua perubahan tersimpan otomatis di server."
      />
      <SettingsIdentity />
      <SettingsNavCards />
      <Panel className="settings-footer-note">
        Profil & logo kanal bisa diatur semua pengguna — modul & pengguna
        khusus owner. Semua perubahan tersimpan otomatis di server.
      </Panel>
    </>
  );
}
