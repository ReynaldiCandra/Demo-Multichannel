'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageTitle } from '@/components/ui';
import { ModulesGrid } from '../_sections';

export default function SettingsModulesPage() {
  return (
    <>
      <Link href="/pengaturan" className="back-link">
        <ChevronLeft size={14} /> Kembali ke pengaturan
      </Link>
      <PageTitle
        eyebrow="PENGATURAN / MODUL"
        title="Modul yang aktif."
        description="Nyalakan hanya bagian yang sedang kamu pakai. Modul nonaktif hilang dari sidebar, data tetap aman."
      />
      <ModulesGrid />
    </>
  );
}
