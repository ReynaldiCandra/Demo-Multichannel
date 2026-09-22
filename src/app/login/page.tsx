'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, LogIn } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const requestReset = () => {
    if (!email) {
      setError('Masukkan email kamu dulu untuk reset password.');
      return;
    }
    setError(null);
    setForgotSent(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        setError(detail?.error ?? 'Gagal masuk. Coba lagi.');
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa koneksi kamu.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/websensial-logo.png"
            alt="Websensial — Digital Solutions That Matter"
            width={876}
            height={198}
          />
        </div>
        <div className="eyebrow">MASUK</div>
        <h1>Dashboard Multichannel</h1>
        <p className="login-sub">
          Pantau seluruh channel, penjualan, dan profit bisnis kamu dari satu tempat.
        </p>

        <form className="login-form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
              data-testid="input-login-email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                data-testid="input-login-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <div className="login-forgot">
            <button type="button" onClick={requestReset} data-testid="button-forgot-password">
              Lupa password?
            </button>
          </div>

          {forgotSent && !error && (
            <div className="login-error" role="status" data-testid="text-login-reset-sent">
              <CircleAlert size={15} />
              <span>Link reset password telah dikirim ke {email}.</span>
            </div>
          )}

          {error && (
            <div className="login-error" role="alert" data-testid="text-login-error">
              <CircleAlert size={15} />
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn btn-primary login-submit"
            type="submit"
            disabled={pending}
            data-testid="button-login"
          >
            <LogIn size={15} /> {pending ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
