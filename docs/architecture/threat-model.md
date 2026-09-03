# Threat model awal

## Tujuan

PinjamAkun memindahkan snapshot cookie yang dibuat secara manual dari pemilik kepada perangkat penerima yang telah disetujui. Sistem tidak membagikan password dan tidak mencoba melewati MFA, CAPTCHA, device binding, atau kontrol keamanan layanan tujuan.

## Trust boundaries

- Private key perangkat tetap non-extractable di origin IndexedDB ekstensi.
- API dan database tidak boleh menerima plaintext cookie atau private key.
- Content script tidak boleh memperoleh primitive generik untuk cookie, crypto, atau network.
- Host permission diminta untuk origin spesifik melalui tindakan pengguna.
- Browser profile, sistem operasi, dan perangkat pengguna tetap dipercaya. E2EE tidak melindungi dari malware lokal atau update ekstensi berbahaya.

## Keputusan MVP

- Cookie-only; localStorage, sessionStorage, IndexedDB situs, dan password dikecualikan.
- Snapshot dibuat manual; tidak ada pemantauan `cookies.onChanged`.
- E2EE tanpa escrow server.
- Data key baru untuk setiap immutable snapshot version.
- Grant memiliki expiry, revocation, dan registered-device limit.
- Semua mutation dan sync harus idempotent dan scoped actor + workspace.

## Batas pencabutan

Pencabutan menghentikan akses API berikutnya dan meminta client kooperatif menghapus cookie/cache. Pencabutan tidak dapat menarik plaintext yang telah disalin, tidak selalu mengakhiri sesi server pihak ketiga, dan bukan DRM. Logout atau session-management API dari layanan tujuan diperlukan untuk pencabutan server-side yang kuat.

## Data yang dilarang dalam log

Cookie values, password, reset/invitation/access/refresh token, private key, decrypted snapshot, dan secret environment. Ciphertext juga harus direduksi dari log untuk menghindari kebocoran metadata dan volume.

## Risiko residual

Partitioned cookie, IP/device binding, passkey, rotasi sesi, anti-bot, dan kebijakan layanan dapat membuat snapshot gagal atau melanggar ketentuan penggunaan. Daftar domain produksi wajib diuji dan ditinjau secara hukum/keamanan.
