'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageTitle } from '@/components/ui';
import { WorkspaceUsersSection } from '../_sections';

export default function SettingsUsersPage() {
  return (
    <>
      <Link href="/pengaturan" className="back-link">
        <ChevronLeft size={14} /> Kembali ke pengaturan
      </Link>
      <PageTitle
        eyebrow="PENGATURAN / PENGGUNA"
        title="Pengguna workspace."
        description="Owner akses penuh · Pengguna kelola data tanpa Pengaturan · Demo hanya melihat — dibatasi juga di server."
      />
      <WorkspaceUsersSection />
    </>
  );
}
