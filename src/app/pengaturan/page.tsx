'use client';

import { PageTitle, Panel } from '@/components/ui';
import { SettingsIdentity, SettingsNavCards } from './_sections';

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
        Rapikan setiap bagian di sub-halaman masing-masing; modul & pengguna khusus owner,
        logo kanal & profil bisa diatur pengguna apa pun kecuali mode demo.
      </Panel>
    </>
  );
}
