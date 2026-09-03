import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function Options() {
  return (
    <main>
      <p className="eyebrow">PINJAMAKUN</p>
      <h1>Perangkat belum dipasangkan</h1>
      <p>
        Hubungkan ekstensi ke dashboard untuk menerima undangan terenkripsi. Private key tetap
        berada di browser ini.
      </p>
      <button type="button" disabled>
        Mulai pairing segera
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
