import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CheckCircle, Devices, LockKey, Timer } from '@phosphor-icons/react';
import './style.css';

function App() {
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
          <button type="button">Masuk</button>
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
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
