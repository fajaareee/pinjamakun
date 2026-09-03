import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowSquareOut, LockKey, ShieldCheck } from '@phosphor-icons/react';
import browser from 'webextension-polyfill';
import { requestCurrentSitePermission } from '../../platform/permissions';
import './style.css';

function Popup() {
  const [tabUrl, setTabUrl] = useState<string>();
  const [status, setStatus] = useState('Belum terhubung');

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setTabUrl(tab?.url);
    });
  }, []);

  async function enableCurrentSite() {
    if (tabUrl === undefined) return;
    try {
      const granted = await requestCurrentSitePermission(tabUrl);
      setStatus(granted ? 'Situs diizinkan' : 'Izin dibatalkan');
    } catch {
      setStatus('Halaman ini tidak didukung');
    }
  }

  return (
    <main>
      <header>
        <div className="mark">
          <LockKey size={18} weight="bold" />
        </div>
        <div>
          <strong>PinjamAkun</strong>
          <span>Snapshot terenkripsi</span>
        </div>
      </header>
      <section className="status">
        <ShieldCheck size={22} weight="duotone" />
        <div>
          <small>Status perangkat</small>
          <p>{status}</p>
        </div>
      </section>
      <section className="site">
        <small>Situs saat ini</small>
        <p>
          {tabUrl === undefined ? 'Memeriksa tab…' : new URL(tabUrl).hostname || 'Tidak didukung'}
        </p>
      </section>
      <button
        type="button"
        onClick={() => void enableCurrentSite()}
        disabled={tabUrl === undefined}
      >
        Izinkan situs ini <ArrowSquareOut size={17} />
      </button>
      <p className="notice">Cookie belum dibaca. Izin hanya diminta setelah tindakan ini.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
