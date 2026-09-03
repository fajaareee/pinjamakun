import { StrictMode, useEffect, useId, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  CheckCircle,
  Devices,
  LockKey,
  SignOut,
  Timer,
  X,
} from '@phosphor-icons/react';
import './style.css';

type AuthUser = Readonly<{ id: string; email: string }>;
type AuthMode = 'login' | 'register';

function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<AuthUser>();

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setUser(((await response.json()) as { user: AuthUser }).user);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) setUser(undefined);
  }

  return (
    <div className="page">
      <nav>
        <a className="brand" href="/">
          <span>
            <LockKey size={17} weight="bold" />
          </span>
          PinjamAkun
        </a>
        <div>
          <a href="#security">Keamanan</a>
          {user ? (
            <button className="account-button" type="button" onClick={() => void logout()}>
              <span>{user.email}</span>
              <SignOut size={17} aria-label="Keluar" />
            </button>
          ) : (
            <button type="button" onClick={() => setAuthOpen(true)}>
              Masuk
            </button>
          )}
        </div>
      </nav>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">AKSES TANPA BERBAGI PASSWORD</p>
            <h1>
              Bagikan sesi.
              <br />
              <em>Tetap pegang kendali.</em>
            </h1>
            <p className="lede">
              Kirim snapshot cookie terenkripsi dengan masa berlaku, batas perangkat, dan pencabutan
              akses.
            </p>
            <button className="primary" type="button">
              Siapkan perangkat <ArrowRight size={18} />
            </button>
          </div>
          <div className="visual" aria-label="Ilustrasi alur akses terenkripsi">
            <div className="orbit owner">
              <span>P</span>
              <small>PEMILIK</small>
            </div>
            <div className="signal">
              <LockKey size={24} weight="duotone" />
              <strong>E2EE</strong>
              <small>SERVER TIDAK DAPAT MEMBACA</small>
            </div>
            <div className="orbit receiver">
              <span>R</span>
              <small>PENERIMA</small>
            </div>
          </div>
        </section>
        <section id="security" className="principles">
          <article>
            <CheckCircle size={22} />
            <h2>Persetujuan eksplisit</h2>
            <p>Setiap domain dan pembaruan snapshot dimulai oleh tindakan pengguna.</p>
          </article>
          <article>
            <Timer size={22} />
            <h2>Akses terbatas</h2>
            <p>Atur kedaluwarsa dan cabut grant dari satu tempat.</p>
          </article>
          <article>
            <Devices size={22} />
            <h2>Perangkat terdaftar</h2>
            <p>Undangan hanya aktif pada instalasi yang telah disetujui.</p>
          </article>
        </section>
      </main>
      {authOpen && !user ? (
        <AuthDialog
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            setAuthOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function AuthDialog({
  mode,
  onModeChange,
  onClose,
  onAuthenticated,
}: Readonly<{
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}>) {
  const titleId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as { user?: AuthUser; error?: string };
      if (!response.ok || !body.user) {
        setError(body.error ?? 'Tidak dapat memproses permintaan. Coba lagi.');
        return;
      }
      onAuthenticated(body.user);
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="auth-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup">
          <X size={20} />
        </button>
        <div className="auth-mark">
          <LockKey size={21} weight="bold" />
        </div>
        <h2 id={titleId}>{mode === 'login' ? 'Selamat datang kembali' : 'Buat akun Anda'}</h2>
        <p className="auth-intro">
          {mode === 'login'
            ? 'Masuk untuk mengelola perangkat dan akses Anda.'
            : 'Password disimpan sebagai hash Argon2, bukan teks asli.'}
        </p>
        <div className="auth-tabs" aria-label="Pilihan autentikasi">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => onModeChange('login')}
          >
            Masuk
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => onModeChange('register')}
          >
            Daftar
          </button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {mode === 'register' ? <small>Minimal 12 karakter.</small> : null}
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Memproses…' : mode === 'login' ? 'Masuk dengan aman' : 'Buat akun'}
          </button>
        </form>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
