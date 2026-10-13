'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronRight,
  CircleUserRound,
  ImageUp,
  KeyRound,
  LockKeyhole,
  Power,
  Settings2,
  Trash2,
  UserPlus,
  UsersRound,
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
/* Kartu identitas (hub): avatar foto + nama + email + role            */
/* ------------------------------------------------------------------ */

export function SettingsIdentity() {
  const session = useSession();

  return (
    <Panel className="settings-intro">
      <span className="settings-avatar" aria-hidden="true">
        {session.data?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.data.imageUrl} alt="" />
        ) : (
          <CircleUserRound size={26} />
        )}
      </span>
      <div>
        <div className="eyebrow">AKUN SAAT INI</div>
        <h2>{session.data?.name ?? 'Memuat…'}</h2>
        <p>
          {session.data?.email ?? '—'} ·{' '}
          {session.data?.role === 'demo'
            ? 'mode demo, hanya melihat'
            : session.data?.role === 'owner'
              ? 'akun owner, akses penuh'
              : 'akun pengguna'}
        </p>
      </div>
      <Link href="/pengaturan/profil" className="settings-intro-link">
        Edit profil <ChevronRight size={14} />
      </Link>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu navigasi hub — satu use case, satu halaman                   */
/* ------------------------------------------------------------------ */

const NAV_CARDS = [
  {
    href: '/pengaturan/profil',
    icon: CircleUserRound,
    title: 'Profil & keamanan',
    description: 'Foto profil, nama, dan ganti password milik kamu sendiri.',
  },
  {
    href: '/pengaturan/logo-kanal',
    icon: ImageUp,
    title: 'Logo kanal',
    description:
      'Upload logo Shopee, TikTok Shop, Lazada, dan lainnya — tampil di semua halaman seperti logo toko.',
  },
  {
    href: '/pengaturan/pengguna',
    icon: UsersRound,
    title: 'Pengguna workspace',
    description: 'Daftar & tambah staf: owner, pengguna, demo — hak akses dijaga di server.',
  },
  {
    href: '/pengaturan/modul',
    icon: Settings2,
    title: 'Modul',
    description: 'Nyalakan/matikan bagian aplikasi yang dipakai; data tidak hilang.',
  },
] as const;

const OWNER_ONLY_CARDS = new Set(['/pengaturan/pengguna', '/pengaturan/modul']);

export function SettingsNavCards() {
  const session = useSession();
  return (
    <div className="settings-nav">
      {NAV_CARDS.map((card) => {
        const Icon = card.icon;
        const locked =
          OWNER_ONLY_CARDS.has(card.href) && session.data?.role !== 'owner';
        return (
          <Link
            key={card.href}
            href={card.href}
            className="settings-nav-card"
            data-testid={`link-settings-${card.href.split('/').pop()}`}
          >
            <span className="settings-nav-icon">
              <Icon size={17} />
            </span>
            <span className="settings-nav-copy">
              <strong>
                {card.title}
                {locked && <Badge tone="neutral">Owner</Badge>}
              </strong>
              <span>{card.description}</span>
            </span>
            <ChevronRight size={15} className="settings-nav-chevron" />
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profil: foto + nama, lalu ganti password (dua panel berurutan)      */
/* ------------------------------------------------------------------ */

export function ProfileSection() {
  const session = useSession();
  const update = useUpdateMyProfile();
  const [name, setName] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const isDemo = session.data?.role === 'demo';
  const savedName = session.data?.name ?? '';
  const imageUrl = session.data?.imageUrl ?? null;

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

  return (
    <>
      <Panel className="profile-card">
        <div className="section-head">
          <span className="settings-symbol settings-symbol-sm">
            <LockKeyhole size={16} />
          </span>
          <div>
            <h2>Profil & foto</h2>
            <p>Identitas akun kamu — foto tampil di avatar seluruh aplikasi.</p>
          </div>
        </div>

        <form className="profile-form" onSubmit={saveProfile}>
          <label className="profile-avatar" title="Ganti foto profil">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="foto profil" />
            ) : (
              <span>{savedName.trim().slice(0, 2).toUpperCase() || '—'}</span>
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
            <span className="profile-avatar-action">
              <ImageUp size={12} /> {photoBusy ? 'Mengunggah…' : imageUrl ? 'Ganti' : 'Upload'}
            </span>
          </label>

          <div className="profile-form-fields">
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
          </div>

          <div className="account-actions">
            {imageUrl && (
              <Button type="button" variant="ghost" onClick={removePhoto} disabled={isDemo || update.isPending}>
                <Trash2 size={13} /> Hapus foto
              </Button>
            )}
            <Button type="submit" disabled={isDemo || update.isPending || name === null}>
              {update.isPending ? 'Menyimpan…' : 'Simpan profil'}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="account-security">
        <ChangePasswordSection isDemo={isDemo} />
      </Panel>
    </>
  );
}

function ChangePasswordSection({ isDemo }: { isDemo: boolean }) {
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
/* Logo kanal (dipindah ke /pengaturan/logo-kanal)                     */
/* ------------------------------------------------------------------ */

export function ChannelLogos({ isDemo }: { isDemo: boolean }) {
  const stores = useListStores();
  const logos = useListChannelLogos();
  const save = useSaveChannelLogo();
  const remove = useDeleteChannelLogo();
  const [busyChannel, setBusyChannel] = useState<string | null>(null);

  // Kanal unik dari data toko — satu baris UI per kanal, nama tampil apa
  // adanya (pemakaian pertama).
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
      // Toast gagal sudah ditampilkan oleh onError hook — tidak perlu ganda.
    } finally {
      setBusyChannel(null);
    }
  };

  return (
    <section>
      <div className="section-head">
        <span className="settings-symbol settings-symbol-sm">
          <ImageUp size={16} />
        </span>
        <div>
          <h2>Logo kanal marketplace</h2>
          <p>
            Upload logo per kanal (Shopee, TikTok Shop, Lazada, dan lainnya) — otomatis tampil
            di semua halaman: Penjualan, Analisa Toko, Produk & Stok, dan lainnya, persis seperti
            logo toko.
          </p>
        </div>
      </div>

      {stores.isLoading || logos.isLoading ? (
        <State type="loading" />
      ) : stores.isError || logos.isError ? (
        <State
          type="error"
          onRetry={() => {
            stores.refetch();
            logos.refetch();
          }}
        />
      ) : channels.size === 0 ? (
        <div className="state">
          <ImageUp size={24} />
          <strong>Belum ada kanal</strong>
          <span>
            Kanal diambil dari daftar toko — tambahkan toko dengan kanal (Shopee, TikTok Shop,
            dan lainnya) di menu Toko, lalu logo bisa diunggah di sini.
          </span>
        </div>
      ) : (
        <div className="channel-logo-list">
          {[...channels.entries()].map(([key, name]) => {
            const current =
              logos.data?.logos.find((logo) => logo.channelKey === key)?.logoUrl ?? null;
            return (
              <div className="channel-logo-row" key={key}>
                <ChannelAvatar channel={name} className="channel-logo-preview" />
                <span className="channel-logo-name">{name}</span>
                <Badge tone={current ? 'good' : 'neutral'}>
                  {current ? 'Logo aktif' : 'Pakai SVG/inisial'}
                </Badge>
                <label className="channel-logo-upload" title={`Ganti logo ${name}`}>
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
                  {current ? 'Ganti' : 'Upload'}
                </label>
                {current && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="channel-logo-delete"
                    disabled={isDemo || remove.isPending}
                    aria-label={`Hapus logo kanal ${name}`}
                    onClick={() => remove.mutate({ channel: name })}
                  >
                    <Trash2 size={13} /> Hapus
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Modul (dipindah ke /pengaturan/modul)                               */
/* ------------------------------------------------------------------ */

export function ModulesGrid() {
  const session = useSession();
  const modules = useListModules();
  const update = useUpdateModule();
  const isDemo = session.data?.role === 'demo';
  const readOnly = session.isLoading || isDemo;
  const isOwner = session.data?.role === 'owner';

  // Tunggu sesi selesai dulu — tanpa ini owner sempat melihat
  // layar "Khusus owner" sesaat saat data sesi masih dimuat.
  if (session.isLoading) {
    return (
      <Panel>
        <State type="loading" />
      </Panel>
    );
  }

  if (!isOwner) {
    return (
      <Panel>
        <div className="state">
          <LockKeyhole size={24} />
          <strong>Khusus owner</strong>
          <span>Modul hanya bisa dikontrol akun owner. Hubungi pemilik workspace bila perlu perubahan.</span>
        </div>
      </Panel>
    );
  }

  return (
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
                  onClick={() => update.mutate({ key: module.key, isEnabled: !module.isEnabled })}
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
  );
}

/* ------------------------------------------------------------------ */
/* Pengguna workspace (owner saja, /pengaturan/pengguna)               */
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
      <Panel>
        <div className="state">
          <LockKeyhole size={24} />
          <strong>Khusus owner</strong>
          <span>Daftar & tambah pengguna hanya bisa oleh akun owner.</span>
        </div>
      </Panel>
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
    <Panel className="workspace-users">
      {users.isLoading ? (
        <State type="loading" />
      ) : users.isError ? (
        <State type="error" onRetry={() => users.refetch()} />
      ) : (
        <>
          <ul className="workspace-user-list" data-testid="list-workspace-users">
            {users.data?.map((user) => (
              <li key={user.id}>
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
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
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

/** Penanda kecil di header sub-halaman ketika akun demo. */
export function RoleNotice({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <div className="settings-note settings-note-inline">
      <LockKeyhole size={15} /> Mode demo hanya bisa melihat
    </div>
  );
}
