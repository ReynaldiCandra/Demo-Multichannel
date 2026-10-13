'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageTitle } from '@/components/ui';
import { ProfileSection, RoleNotice } from '../_sections';
import { useSession } from '@/lib/api/hooks';

export default function SettingsProfilePage() {
  const session = useSession();
  const isDemo = session.data?.role === 'demo';

  return (
    <>
      <Link href="/pengaturan" className="back-link">
        <ChevronLeft size={14} /> Kembali ke pengaturan
      </Link>
      <PageTitle
        eyebrow="PENGATURAN / PROFIL"
        title="Profil & keamanan."
        description="Foto profil dan nama tampil di seluruh aplikasi; password hanya kamu yang tahu."
      />
      <RoleNotice isDemo={isDemo} />
      <ProfileSection />
    </>
  );
}
