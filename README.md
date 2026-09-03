# PinjamAkun

PinjamAkun adalah fondasi produk untuk membagikan **snapshot cookie secara manual** kepada perangkat yang disetujui. Snapshot akan dienkripsi end-to-end; server dirancang hanya sebagai relay ciphertext.

> Gunakan hanya untuk akun dan layanan yang mengizinkan Anda membagikan akses. Proyek ini tidak dirancang untuk membagikan password, melewati MFA/CAPTCHA, memantau cookie otomatis, atau menjamin kompatibilitas dengan semua situs.

## Workspace

- `apps/extension`: WXT + React untuk Chrome, Edge, dan Firefox.
- `apps/dashboard`: dashboard React/Vite.
- `apps/api`: Fastify API.
- `apps/worker`: background jobs.
- `packages/contracts`: wire schemas yang browser-safe.
- `packages/domain`: policy dan state machine murni.
- `packages/crypto`: primitive protokol E2EE yang versioned.

## Pengembangan

Persyaratan: Node.js 22+, pnpm 10+, dan Docker untuk PostgreSQL.

1. Salin `.env.example` menjadi `.env` dan ganti semua placeholder secret.
2. Jalankan `pnpm install`.
3. Jalankan `pnpm dev` untuk workspace atau filter aplikasi yang dibutuhkan.
4. Jalankan `pnpm check` sebelum commit.

Build ekstensi menghasilkan target Chromium dan Firefox. Muat output Chromium unpacked dari folder `.output/chrome-mv3` untuk pengujian lokal. Firefox memakai output `.output/firefox-mv3`.

## Status implementasi

Fondasi, kontrak, policy dasar, primitive WebCrypto, health API, dashboard awal, dan alur optional host permission telah tersedia. Pairing, database/auth, encrypted invitation, capture/apply cookie, dan sync relay berikutnya masih harus diimplementasikan sebelum data sesi nyata digunakan.

Baca `docs/architecture/threat-model.md` sebelum menambahkan operasi cookie atau token.
