'use client';

import { useState, type FormEvent } from 'react';
import { Check, LockKeyhole, Power, Settings2, UserPlus, KeyRound } from 'lucide-react';
import {
  useChangePassword,
  useCreateWorkspaceUser,
  useListModules,
  useListWorkspaceUsers,
  useSession,
  useUpdateModule,
} from '@/lib/api/hooks';
import { Badge, Button, Field, Panel, PageTitle, PasswordInput, State } from '@/components/ui';

export default function SettingsPage() {
  const modules = useListModules();
  const session = useSession();
  const update = useUpdateModule();
  const isDemo = session.data?.role === 'demo';
  const readOnly = session.isLoading || isDemo;

  const isOwner = session.data?.role === 'owner';

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

      <Panel className="account-security">
        <AccountSecurity isDemo={isDemo} />
      </Panel>

      {isOwner && <WorkspaceUsers />}

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

/* ------------------------------------------------------------------ */
/* Ganti password sendiri                                              */
/* ------------------------------------------------------------------ */

function AccountSecurity({ isDemo }: { isDemo: boolean }) {
  const session = useSession();
  const changePassword = useChangePassword({
    onSuccess: () => setForm({ currentPassword: '', newPassword: '', confirm: '' }),
  });
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setError('Konfirmasi password tidak sama');
      return;
    }
    changePassword.mutate({
      data: { currentPassword: form.currentPassword, newPassword: form.newPassword },
    });
  };

  return (
    <section>
      <div className="section-head">
        <span className="settings-symbol settings-symbol-sm">
          <KeyRound size={16} />
        </span>
        <div>
          <h2>Ganti password</h2>
          <p>
            {session.data?.email ? `Akun ${session.data.email}` : 'Akun kamu'} — password baru
            minimal 8 karakter.
          </p>
        </div>
      </div>
      <form className="account-form" onSubmit={submit}>
        <Field label="Password lama">
          <PasswordInput
            required
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
          />
        </Field>
        <Field label="Password baru">
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
          />
        </Field>
        <Field label="Ulangi password baru">
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          />
        </Field>
        <div className="account-actions">
          {error && <span className="account-error">{error}</span>}
          {changePassword.isError && (
            <span className="account-error">
              {(changePassword.error as Error)?.message || 'Gagal mengganti password'}
            </span>
          )}
          <Button type="submit" disabled={changePassword.isPending || isDemo}>
            {changePassword.isPending ? 'Menyimpan…' : 'Simpan password baru'}
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Daftar & tambah user workspace (owner saja)                         */
/* ------------------------------------------------------------------ */

function WorkspaceUsers() {
  const users = useListWorkspaceUsers();
  const create = useCreateWorkspaceUser({
    onSuccess: () => setForm({ email: '', name: '', password: '', role: 'pengguna' }),
  });
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'pengguna' });
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    create.mutate(
      { data: form },
      {
        onError: (err) =>
          setError(
            (err as Error & { message?: string })?.message ||
              'Gagal menambah user — cek koneksi atau email yang sudah terdaftar.',
          ),
      },
    );
  };

  return (
    <Panel className="workspace-users">
      <div className="section-head">
        <span className="settings-symbol settings-symbol-sm">
          <UserPlus size={16} />
        </span>
        <div>
          <h2>Pengguna workspace</h2>
          <p>
            Owner akses penuh · Pengguna kelola data tanpa Pengaturan · Demo hanya melihat — semua
            dibatasi juga di server.
          </p>
        </div>
      </div>

      {users.isLoading ? (
        <State type="loading" />
      ) : users.isError ? (
        <State type="error" onRetry={() => users.refetch()} />
      ) : (
        <>
          <ul className="workspace-user-list" data-testid="list-workspace-users">
            {users.data?.map((user) => (
              <li key={user.id}>
                <span className="workspace-user-avatar" aria-hidden="true">
                  {user.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? '')
                    .join('')}
                </span>
                <span className="workspace-user-copy">
                  <strong className="workspace-user-name">{user.name}</strong>
                  <span className="workspace-user-email">{user.email}</span>
                </span>
                <Badge tone={user.role === 'owner' ? 'good' : 'neutral'}>
                  {user.role === 'owner'
                    ? 'Owner'
                    : user.role === 'pengguna'
                      ? 'Pengguna'
                      : 'Demo'}
                </Badge>
              </li>
            ))}
          </ul>

          <form className="account-form" onSubmit={submit}>
            <Field label="Email">
              <input
                type="email"
                required
                placeholder="staf@gmail.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Nama">
              <input
                type="text"
                required
                placeholder="Nama staf"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Password awal" hint="Minimal 8 karakter — minta user ganti sendiri nanti.">
              <PasswordInput
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                <option value="pengguna">Pengguna — kelola data, tanpa Pengaturan</option>
                <option value="owner">Owner — akses penuh</option>
                <option value="demo">Demo — hanya lihat</option>
              </select>
            </Field>
            <div className="account-actions">
              {error && <span className="account-error">{error}</span>}
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Menyimpan…' : 'Tambah user'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Panel>
  );
}
