'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageTitle, Panel } from '@/components/ui';
import { ChannelLogos, RoleNotice } from '../_sections';
import { useSession } from '@/lib/api/hooks';

export default function SettingsChannelLogosPage() {
  const session = useSession();
  const isDemo = session.data?.role === 'demo';

  return (
    <>
      <Link href="/pengaturan" className="back-link">
        <ChevronLeft size={14} /> Kembali ke pengaturan
      </Link>
      <PageTitle
        eyebrow="PENGATURAN / LOGO KANAL"
        title="Logo kanal marketplace."
        description="Satu logo per kanal, dipakai seragam di Dashboard, Toko, Penjualan, Analisa, dan lainnya."
      />
      <RoleNotice isDemo={isDemo} />
      <Panel>
        <ChannelLogos isDemo={isDemo} />
      </Panel>
    </>
  );
}
