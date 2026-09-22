'use client';

import { Check, LockKeyhole, Power, Settings2 } from 'lucide-react';
import { useListModules, useSession, useUpdateModule } from '@/lib/api/hooks';
import { Badge, Panel, PageTitle, State } from '@/components/ui';

export default function SettingsPage() {
  const modules = useListModules();
  const session = useSession();
  const update = useUpdateModule();
  const isDemo = session.data?.role === 'demo';
  const readOnly = session.isLoading || isDemo;

  return (
    <>
      <PageTitle
        eyebrow="PENGATURAN / MODUL"
        title="Ruang kendali."
        description="Nyalakan hanya bagian yang sedang kamu pakai. Data tetap tersimpan saat modul disembunyikan."
      />

      <Panel className="settings-intro">
        <div className="settings-symbol">
          <Settings2 size={24} />
        </div>
        <div>
          <div className="eyebrow">WORKSPACE PRIBADI</div>
          <h2>Modul yang aktif</h2>
          <p>
            Modul nonaktif hilang dari sidebar, tetapi data dan endpoint-nya tidak dihapus.
            Kamu bisa menyalakannya kembali kapan saja.
          </p>
        </div>
        {isDemo && (
          <div className="settings-note">
            <LockKeyhole size={15} /> Mode demo hanya bisa melihat
          </div>
        )}
      </Panel>

      <div className="settings-grid">
        {modules.isLoading ? (
          <Panel>
            <State type="loading" />
          </Panel>
        ) : modules.isError ? (
          <Panel>
            <State type="error" onRetry={() => modules.refetch()} />
          </Panel>
        ) : !modules.data?.length ? (
          <Panel>
            <State type="empty" />
          </Panel>
        ) : (
          modules.data.map((module) => {
            const disabled = module.isCore || readOnly || update.isPending;
            return (
              <Panel className="module-card" key={module.key}>
                <div className="module-card-head">
                  <div>
                    <span className="module-kicker">{module.key.replaceAll('_', ' ')}</span>
                    <h2>{module.label}</h2>
                  </div>
                  <Badge tone={module.isEnabled ? 'good' : 'neutral'}>
                    {module.isEnabled ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <p>{module.description}</p>
                <div className="module-card-foot">
                  {module.isCore ? (
                    <span className="module-locked">
                      <LockKeyhole size={13} /> Modul inti
                    </span>
                  ) : (
                    <span className="module-state">
                      <Check size={13} /> Sidebar {module.isEnabled ? 'ditampilkan' : 'disembunyikan'}
                    </span>
                  )}
                  <button
                    className="module-toggle"
                    type="button"
                    disabled={disabled}
                    aria-pressed={module.isEnabled}
                    aria-label={`${module.isEnabled ? 'Nonaktifkan' : 'Aktifkan'} ${module.label}`}
                    onClick={() =>
                      update.mutate({ key: module.key, isEnabled: !module.isEnabled })
                    }
                    data-testid={`button-toggle-module-${module.key}`}
                  >
                    <Power size={14} />
                    {module.isEnabled ? 'Matikan' : 'Nyalakan'}
                  </button>
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </>
  );
}