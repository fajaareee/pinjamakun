# Menjalankan PinjamAkun Online dalam Mode Production

Panduan ringkas ini menerbitkan dashboard dan health API ke
`https://acc.fnoor.my.id` menggunakan VPS Ubuntu, Nginx, dan Cloudflare Tunnel.
Instruksi instalasi yang lebih rinci tersedia di [`deployment-vps.md`](deployment-vps.md).

> **Batas implementasi:** deployment saat ini menampilkan landing page dan menyediakan health API.
> Tombol **Masuk** belum berfungsi karena autentikasi, pairing, database aplikasi, dan sync relay belum
> diimplementasikan. Jangan gunakan deployment ini untuk data sesi nyata.

## Arsitektur production

```mermaid
flowchart LR
    B[Browser] -->|HTTPS| C[Cloudflare]
    C -->|Tunnel terenkripsi| N[Nginx 127.0.0.1:8080]
    N -->|Static files| D[Dashboard dist]
    N -->|/api/*| A[Fastify 127.0.0.1:3000]
    A -.-> P[(PostgreSQL 127.0.0.1:5432)]
```

Tidak ada port aplikasi yang dibuka ke internet. VPS hanya menerima SSH; Cloudflare Tunnel membuat
koneksi keluar menuju Cloudflare.

## 1. Siapkan domain dan VPS

Persyaratan:

- VPS Ubuntu 22.04/24.04, minimal 1 vCPU dan 1 GB RAM.
- DNS `fnoor.my.id` dikelola Cloudflare.
- Hostname production: `acc.fnoor.my.id`.
- Node.js 22, pnpm 10, Git, Nginx, Docker Engine, Docker Compose, dan `cloudflared`.
- Repository tersedia pada `/opt/pinjamakun`.

Ikuti bagian 2–5 pada [`deployment-vps.md`](deployment-vps.md) untuk instalasi server dan clone
repository. Firewall harus hanya membuka SSH:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

Jangan membuka port `80`, `443`, `3000`, `5432`, atau `8080`.

## 2. Buat konfigurasi production

Buat tiga secret berbeda langsung di VPS:

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 32
```

Buat `/etc/pinjamakun/api.env` dengan permission terbatas:

```bash
sudo install -d -m 0750 -o root -g pinjamakun /etc/pinjamakun
sudo nano /etc/pinjamakun/api.env
```

Isi seluruh placeholder berikut. Password pada `DATABASE_URL` harus di-URL-encode apabila memuat
karakter khusus.

```dotenv
NODE_ENV=production
PUBLIC_APP_URL=https://acc.fnoor.my.id
API_HOST=127.0.0.1
API_PORT=3000
DATABASE_URL=postgresql://pinjamakun:GANTI_PASSWORD_DATABASE_URL_ENCODED@127.0.0.1:5432/pinjamakun
AUTH_SECRET=GANTI_DENGAN_SECRET_ACAK_MINIMAL_32_BYTE
TOKEN_HMAC_KEY=GANTI_DENGAN_SECRET_ACAK_YANG_BERBEDA
```

```bash
sudo chown root:pinjamakun /etc/pinjamakun/api.env
sudo chmod 0640 /etc/pinjamakun/api.env
sudo nano /etc/pinjamakun/postgres.env
```

Isi password database mentah yang sama, tanpa URL encoding:

```dotenv
POSTGRES_PASSWORD=GANTI_PASSWORD_DATABASE
```

```bash
sudo chown root:pinjamakun /etc/pinjamakun/postgres.env
sudo chmod 0640 /etc/pinjamakun/postgres.env
```

Jangan commit atau menyalin isi kedua file environment tersebut ke log, chat, maupun tiket publik.

## 3. Jalankan database dan build production

```bash
cd /opt/pinjamakun
sudo docker compose --env-file /etc/pinjamakun/postgres.env up -d postgres
sudo docker compose --env-file /etc/pinjamakun/postgres.env ps
sudo docker compose --env-file /etc/pinjamakun/postgres.env exec postgres pg_isready -U pinjamakun -d pinjamakun
pnpm install --frozen-lockfile
pnpm check
sudo chown -R pinjamakun:pinjamakun /opt/pinjamakun
```

`pnpm check` wajib berhasil. Artefak yang dipublikasikan adalah:

- Dashboard: `/opt/pinjamakun/apps/dashboard/dist`
- API: `/opt/pinjamakun/apps/api/dist/server.js`

## 4. Jalankan API dan Nginx

Pasang unit `pinjamakun-api.service` dan virtual host Nginx dari bagian 9–10
[`deployment-vps.md`](deployment-vps.md), lalu aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pinjamakun-api
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://127.0.0.1:3000/health
curl --fail -H 'Host: acc.fnoor.my.id' http://127.0.0.1:8080/api/health
```

Jangan melanjutkan jika salah satu health check gagal. Periksa log API tanpa mencetak environment:

```bash
sudo journalctl -u pinjamakun-api -n 100 --no-pager
```

## 5. Hubungkan Cloudflare Tunnel

Kelola tunnel melalui **Cloudflare Dashboard → Zero Trust → Networks → Connectors → Cloudflare
Tunnels**:

1. Pilih **Create a tunnel** dan connector **Cloudflared**.
2. Beri nama `pinjamakun-vps`.
3. Pilih environment **Debian** dan arsitektur VPS.
4. Salin dan jalankan perintah instalasi connector yang ditampilkan dashboard pada VPS.
5. Tunggu connector berstatus **Healthy**.

Perintah dashboard memuat token rahasia dan biasanya menyerupai:

```bash
sudo cloudflared service install <TUNNEL-TOKEN-DARI-DASHBOARD>
```

Jangan commit atau membagikan token tersebut. Pada tab **Public Hostnames** atau **Routes**, tambahkan:

- Subdomain `acc`
- Domain `fnoor.my.id`
- Path kosong
- Service `HTTP`
- URL `127.0.0.1:8080`

Cloudflare mengelola DNS dan konfigurasi tunnel secara remote. Tidak perlu membuat
`/etc/cloudflared/config.yml`, credential JSON, DNS route CLI, atau unit systemd khusus. Verifikasi
connector bawaan:

```bash
sudo systemctl status cloudflared --no-pager
sudo systemctl is-enabled cloudflared
```

Jangan menambahkan A/AAAA record menuju IP VPS sebagai fallback.

## 6. Verifikasi dari internet

Jalankan dari komputer lokal, bukan dari proses aplikasi:

```bash
curl --fail https://acc.fnoor.my.id/
curl --fail https://acc.fnoor.my.id/health
curl --fail https://acc.fnoor.my.id/api/health
```

Kemudian buka `https://acc.fnoor.my.id` pada browser. Hasil yang diharapkan:

- Landing page tampil melalui HTTPS.
- `/health` dan `/api/health` mengembalikan JSON dengan `status: "ok"`.
- Tidak ada port origin yang dapat diakses langsung dari internet.
- Tombol **Masuk** tetap belum aktif sampai fitur autentikasi diimplementasikan.

## 7. Memasang ekstensi browser

Ekstensi tidak dijalankan oleh VPS dan tidak otomatis tersedia dari website. Untuk pengujian internal,
ambil artefak build dari server/CI lalu muat secara manual:

- Chrome/Edge: aktifkan Developer mode dan **Load unpacked** folder
  `apps/extension/.output/chrome-mv3`.
- Firefox: buka `about:debugging#/runtime/this-firefox`, pilih **Load Temporary Add-on**, lalu pilih
  `manifest.json` dari `apps/extension/.output/firefox-mv2`.

Untuk distribusi production kepada pengguna, submit artefak yang telah direview ke Chrome Web Store,
Microsoft Edge Add-ons, atau Firefox Add-ons. Jangan meminta host permission saat instalasi; izin domain
harus tetap diminta dari tindakan pengguna yang eksplisit.

## 8. Update deployment

Setelah commit baru tersedia pada branch `main`:

```bash
cd /opt/pinjamakun
sudo -u pinjamakun git fetch --prune origin
sudo -u pinjamakun git checkout main
sudo -u pinjamakun git pull --ff-only origin main
sudo -u pinjamakun pnpm install --frozen-lockfile
sudo -u pinjamakun pnpm check
sudo systemctl restart pinjamakun-api
sudo systemctl is-active --quiet pinjamakun-api
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart cloudflared
sudo systemctl is-active --quiet cloudflared
curl --fail --retry 5 --retry-delay 2 https://acc.fnoor.my.id/health
```

Jika update gagal, jangan menjalankan source TypeScript secara langsung. Pertahankan versi lama atau
checkout kembali commit tervalidasi, build ulang, lalu restart service.

## Checklist selesai

- [ ] `pnpm check` berhasil pada commit yang di-deploy.
- [ ] PostgreSQL, API, Nginx, dan tunnel aktif.
- [ ] API dan database hanya bind ke loopback.
- [ ] DNS hostname mengarah ke Cloudflare Tunnel.
- [ ] Website dan kedua health endpoint dapat diakses melalui HTTPS.
- [ ] Secret unik, tidak di-commit, dan file environment berpermission `0640`.
- [ ] Backup database terenkripsi berada di luar VPS.
- [ ] Tidak ada cookie, token, private key, ciphertext, atau environment secret pada log.
