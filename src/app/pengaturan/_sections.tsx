'use client';

import { useState, type FormEvent } from 'react';
import {
  Check,
  CircleUserRound,
  ImageUp,
  KeyRound,
  LockKeyhole,
  Power,
  RefreshCw,
  Trash2,
  UsersRound,
  Settings2,
  Plus,
  AlertCircle,
} from 'lucide-react';
import {
  useChangePassword,
  useCreateWorkspaceUser,
  useDeleteChannelLogo,
  useListChannelLogos,
  useListModules,
  useListStores,
  useListWorkspaceUsers,
  useSaveChannelLogo,
  useSession,
  useUpdateModule,
  useUpdateMyProfile,
  uploadChannelLogo,
  uploadProfileImage,
} from '@/lib/api/hooks';
import { Badge, Button, ChannelAvatar, Field, Panel, PasswordInput, State } from '@/components/ui';

/* ------------------------------------------------------------------ */
/* Profil & keamanan                                                 */
/* ------------------------------------------------------------------ */

export function ProfileSection() {
  const session = useSession();
  const update = useUpdateMyProfile();
  const changePassword = useChangePassword({
    onSuccess: () => setForm({ currentPassword: '', newPassword: '', confirm: '' }),
  });

  const isDemo = session.data?.role === 'demo';
  const savedName = session.data?.name ?? '';
  const imageUrl = session.data?.imageUrl ?? null;

  const [name, setName] = useState<string | null>(null);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate({ data: { name: name ?? savedName } });
  };

  const handlePhoto = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      setPhotoBusy(true);
      const { url } = await uploadProfileImage(file);
      update.mutate({ data: { imageUrl: url } });
    } catch {
      // Toast gagal upload sudah tampil dari helper uploadImage.
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => update.mutate({ data: { imageUrl: null } });

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
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
    <div className="settings-one-card-layout">
      <section className="settings-card">
        <div className="settings-card-head">
          <span className="settings-symbol">
            <CircleUserRound size={14} />
          </span>
          <div className="settings-card-text">
            <h2 className="settings-card-title">Profil</h2>
            <p className="settings-card-desc">Foto, nama, dan ganti password akun kamu sendiri.</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-col">
            <div className="profile-identity">
              <div className="profile-avatar">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="foto profil" />
                ) : (
                  <span className="profile-avatar-fallback">
                    {savedName.trim().slice(0, 2).toUpperCase() || '—'}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  disabled={isDemo || photoBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void handlePhoto(file);
                  }}
                />
              </div>
              <div className="profile-avatar-footer">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={isDemo || photoBusy}
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
                    input?.click();
                  }}
                >
                  {photoBusy ? (
                    <>
                      <RefreshCw size={11} className="rotate-cw" /> Uploading…
                    </>
                  ) : (
                    <>
                      <ImageUp size={11} /> Upload
                    </>
                  )}
                </Button>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    onClick={removePhoto}
                    disabled={isDemo || update.isPending}
                  >
                    <Trash2 size={11} /> Hapus
                  </Button>
                )}
              </div>
            </div>

            <Field label="Nama" hint="Dipakai di avatar & sapaan dashboard.">
              <input
                type="text"
                required
                value={name ?? savedName}
                onChange={(event) => setName(event.target.value)}
                disabled={isDemo || update.isPending}
                data-testid="input-profile-name"
              />
            </Field>
            <Field label="Email">
              <input type="email" value={session.data?.email ?? ''} disabled />
            </Field>

            <div className="profile-actions">
              <Button type="submit" disabled={isDemo || update.isPending || name === null}>
                {update.isPending ? 'Menyimpan…' : 'Simpan profil'}
              </Button>
            </div>
          </div>

          <div className="profile-col">
            <h3 className="profile-col-heading">Keamanan</h3>
            <p className="profile-col-desc">Password yang hanya kamu yang tahu.</p>

            <form className="settings-form" onSubmit={submitPassword}>
              <Field label="Password lama">
                <PasswordInput
                  required
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
                />
              </Field>
              <Field label="Password baru" hint="Minimal 8 karakter">
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

              <div className="settings-form-actions">
                {error && <span className="settings-form-error">{error}</span>}
                {changePassword.isError && (
                  <span className="settings-form-error">
                    {(changePassword.error as Error)?.message || 'Gagal mengganti password'}
                  </span>
                )}
                <Button type="submit" disabled={changePassword.isPending || isDemo}>
                  {changePassword.isPending ? 'Menyimpan…' : 'Simpan password baru'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Logo kanal                                                        */
/* ------------------------------------------------------------------ */

export function ChannelLogos({ isDemo }: { isDemo: boolean }) {
  const stores = useListStores();
  const logos = useListChannelLogos();
  const save = useSaveChannelLogo();
  const remove = useDeleteChannelLogo();
  const [busyChannel, setBusyChannel] = useState<string | null>(null);

  const channels = new Map<string, string>();
  for (const store of stores.data ?? []) {
    const key = store.channel.toLowerCase().trim();
    if (key && !channels.has(key)) channels.set(key, store.channel);
  }

  const handleFile = async (channel: string, file: File | null | undefined) => {
    if (!file) return;
    try {
      setBusyChannel(channel.toLowerCase().trim());
      const { url } = await uploadChannelLogo(file);
      await save.mutateAsync({ channel, logoUrl: url });
    } catch {
      // Toast gagal sudah ditampilkan oleh onError hook.
    } finally {
      setBusyChannel(null);
    }
  };

  return (
    <section className="settings-card channel-logos-layout">
      <div className="settings-card-head">
        <span className="settings-symbol">
          <ImageUp size={14} />
        </span>
        <div className="settings-card-text">
          <h2 className="settings-card-title">Logo kanal</h2>
          <p className="settings-card-desc">Satu logo per kanal — tampil otomatis di semua halaman yang memakai nama kanal.</p>
        </div>
      </div>

      {stores.isLoading || logos.isLoading ? (
        <div className="settings-state">
          <State type="loading" />
        </div>
      ) : stores.isError || logos.isError ? (
        <div className="settings-state">
          <State type="error" onRetry={() => { stores.refetch(); logos.refetch(); }} />
        </div>
      ) : channels.size === 0 ? (
        <div className="settings-state-empty">
          <ImageUp size={22} />
          <div>
            <strong>Belum ada kanal</strong>
            <p>
              Tambahkan toko dengan kanal (Shopee, TikTok Shop, dan lain-lain) di menu Toko,
              lalu logo akan bisa diunggah di sini.
            </p>
          </div>
        </div>
      ) : (
        <div className="channel-logos-list">
          {[...channels.entries()].map(([key, name]) => {
            const current =
              logos.data?.logos.find((logo) => logo.channelKey === key)?.logoUrl ?? null;
            return (
              <div className="channel-logo-row" key={key}>
                <ChannelAvatar channel={name} className="channel-logo-preview" />
                <div className="channel-logo-info">
                  <div className="channel-logo-meta">
                    <span className="channel-logo-name">{name}</span>
                    <Badge tone={current ? 'good' : 'neutral'}>
                      {current ? 'Logo aktif' : 'Pakai SVG/inisial'}
                    </Badge>
                  </div>
                  <p className="channel-logo-desc">
                    {current
                      ? 'Logo ini akan tampil di semua halaman yang memakai nama kanal.'
                      : 'Upload logo untuk kanal ini — tampil otomatis di semua halaman.'}
                  </p>
                </div>
                <div className="channel-logo-actions">
                  <label
                    className={`channel-logo-upload ${busyChannel === key ? 'busy' : ''}`}
                    title={`Ganti logo ${name}`}
                  >
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      disabled={isDemo || busyChannel === key}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        void handleFile(name, file);
                      }}
                    />
                    {busyChannel === key ? (
                      <>
                        <RefreshCw size={12} className="rotate-cw" /> Uploading…
                      </>
                    ) : current ? (
                      <>
                        <ImageUp size={12} /> Ganti
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Upload
                      </>
                    )}
                  </label>
                  {current && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      disabled={isDemo || remove.isPending}
                      aria-label={`Hapus logo kanal ${name}`}
                      onClick={() => remove.mutate({ channel: name })}
                    >
                      <Trash2 size={12} /> Hapus
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Modul                                                             */
/* ------------------------------------------------------------------ */

export function ModulesGrid() {
  const session = useSession();
  const modules = useListModules();
  const update = useUpdateModule();
  const isDemo = session.data?.role === 'demo';
  const readOnly = session.isLoading || isDemo;
  const isOwner = session.data?.role === 'owner';

  if (session.isLoading) {
    return (
      <Panel>
        <State type="loading" />
      </Panel>
    );
  }

  if (!isOwner) {
    return (
      <section className="settings-card settings-card--state">
        <div className="settings-state-locked">
          <LockKeyhole size={22} />
          <div>
            <strong>Khusus owner</strong>
            <p>Modul hanya bisa dikontrol akun owner. Hubungi pemilik workspace bila perlu perubahan.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="settings-card-list">
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
            <section className="settings-card" key={module.key}>
              <div className="settings-card-head">
                <span className="settings-symbol">
                  {module.isCore ? <LockKeyhole size={13} /> : <Settings2 size={13} />}
                </span>
                <div className="settings-card-text">
                  <span className="module-kicker">
                    {module.key.replaceAll('_', ' ')}
                  </span>
                  <h2 className="settings-card-title">{module.label}</h2>
                </div>
                <Badge tone={module.isEnabled ? 'good' : 'neutral'}>
                  {module.isEnabled ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
              <p className="settings-card-desc module-desc">{module.description}</p>
              <div className="settings-card-foot">
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
                  onClick={() => update.mutate({ key: module.key, isEnabled: !module.isEnabled })}
                  data-testid={`button-toggle-module-${module.key}`}
                >
                  <Power size={14} />
                  {module.isEnabled ? 'Matikan' : 'Nyalakan'}
                </button>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pengguna workspace                                                */
/* ------------------------------------------------------------------ */

export function WorkspaceUsersSection() {
  const session = useSession();

  if (session.isLoading) {
    return (
      <Panel>
        <State type="loading" />
      </Panel>
    );
  }

  if (session.data?.role !== 'owner') {
    return (
      <section className="settings-card settings-card--state">
        <div className="settings-state-locked">
          <LockKeyhole size={22} />
          <div>
            <strong>Khusus owner</strong>
            <p>Daftar & tambah pengguna hanya bisa oleh akun owner.</p>
          </div>
        </div>
      </section>
    );
  }

  return <WorkspaceUsers />;
}

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
    <section className="settings-card">
      <div className="settings-card-head">
        <span className="settings-symbol">
          <UsersRound size={14} />
        </span>
        <div className="settings-card-text">
          <h2 className="settings-card-title">Pengguna workspace</h2>
          <p className="settings-card-desc">Daftar staf & tambah user baru dengan role yang jelas.</p>
        </div>
      </div>

      {users.isLoading ? (
        <div className="settings-state">
          <State type="loading" />
        </div>
      ) : users.isError ? (
        <div className="settings-state">
          <State type="error" onRetry={() => users.refetch()} />
        </div>
      ) : (
        <>
          <ul className="workspace-user-list" data-testid="list-workspace-users">
            {users.data?.map((user) => (
              <li key={user.id} className="workspace-user-row">
                {user.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="workspace-user-avatar" src={user.imageUrl} alt="" />
                ) : (
                  <span className="workspace-user-avatar" aria-hidden="true">
                    {user.name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                )}
                <span className="workspace-user-copy">
                  <strong className="workspace-user-name">{user.name}</strong>
                  <span className="workspace-user-email">{user.email}</span>
                </span>
                <Badge tone={user.role === 'owner' ? 'good' : 'neutral'}>
                  {user.role === 'owner' ? 'Owner' : user.role === 'pengguna' ? 'Pengguna' : 'Demo'}
                </Badge>
              </li>
            ))}
          </ul>

          <form className="settings-form" onSubmit={submit}>
            <div className="settings-form-grid">
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
            </div>

            <div className="settings-form-actions">
              {error && <span className="settings-form-error">{error}</span>}
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Menyimpan…' : 'Tambah user'}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

/** Penanda kecil di header sub-halaman ketika akun demo. */
export function RoleNotice({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <div className="settings-note">
      <LockKeyhole size={15} /> Mode demo hanya bisa melihat
    </div>
  );
}
