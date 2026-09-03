# Panduan Deploy PinjamAkun ke VPS

Panduan ini men-deploy kondisi repository PinjamAkun saat ini pada VPS Ubuntu 22.04/24.04 menggunakan:

- Nginx lokal sebagai reverse proxy dan static file server.
- Cloudflare Tunnel sebagai satu-satunya jalur publik ke `acc.fnoor.my.id`.
- TLS publik yang diterminasi oleh Cloudflare.
- Node.js 22 dan pnpm 10 untuk API.
- Docker Compose untuk PostgreSQL.
- systemd untuk menjaga API dan tunnel tetap berjalan.

> **Status aplikasi:** repository saat ini masih berupa fondasi MVP. Dashboard dan endpoint health API dapat di-deploy, tetapi database/auth, pairing perangkat, undangan terenkripsi, worker queue, serta capture/apply cookie belum diimplementasikan. Jangan gunakan untuk data sesi nyata sebelum fitur tersebut selesai dan menjalani security review.

## 1. Prasyarat

Siapkan:

- VPS Ubuntu 22.04 atau 24.04 dengan minimal 1 vCPU dan 1 GB RAM.
- User non-root dengan akses `sudo`.
- Zone `fnoor.my.id` aktif di Cloudflare dan nameserver domain sudah memakai Cloudflare.
- Hak untuk membuat Cloudflare Tunnel dan DNS hostname `acc.fnoor.my.id`.
- VPS dapat membuat koneksi keluar ke Cloudflare pada port `7844`; inbound hanya memerlukan SSH.
- Akses baca ke repository `https://github.com/fajaareee/pinjamakun.git`.

Semua contoh menggunakan direktori `/opt/pinjamakun`, hostname `acc.fnoor.my.id`, dan named tunnel `pinjamakun-vps`.

## 2. Persiapkan server

Masuk ke VPS, lalu perbarui paket:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git nginx
```

Aktifkan firewall tanpa memutus SSH:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

Jangan membuka port `80`, `443`, `3000`, atau `5432` ke internet. Nginx, API, dan PostgreSQL hanya bind ke loopback; `cloudflared` membuat koneksi keluar menuju Cloudflare.

## 3. Instal Docker

Gunakan repository resmi Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Keluar dari sesi SSH lalu masuk kembali agar grup `docker` aktif. Verifikasi:

```bash
docker --version
docker compose version
```

## 4. Instal Node.js dan pnpm

Instal Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@10.15.1 --activate
node --version
pnpm --version
```

## 5. Buat user dan ambil source code

Buat service account tanpa shell login:

```bash
sudo useradd --system --create-home --home-dir /var/lib/pinjamakun --shell /usr/sbin/nologin pinjamakun
sudo mkdir -p /opt/pinjamakun
sudo chown "$USER":pinjamakun /opt/pinjamakun
sudo chmod 2775 /opt/pinjamakun
```

Clone branch `main`:

```bash
git clone --branch main --single-branch https://github.com/fajaareee/pinjamakun.git /opt/pinjamakun
cd /opt/pinjamakun
```

Jika repository menjadi private, gunakan deploy key read-only. Jangan menaruh Personal Access Token di URL clone, file konfigurasi, atau shell history.

## 6. Konfigurasi environment produksi

Buat secret acak pada terminal VPS:

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 32
```

Buat `/etc/pinjamakun/api.env`:

```bash
sudo install -d -m 0750 -o root -g pinjamakun /etc/pinjamakun
sudo nano /etc/pinjamakun/api.env
```

Isi file berikut dan ganti seluruh placeholder:

```dotenv
NODE_ENV=production
PUBLIC_APP_URL=https://acc.fnoor.my.id
API_HOST=127.0.0.1
API_PORT=3000
DATABASE_URL=postgresql://pinjamakun:GANTI_PASSWORD_DATABASE_YANG_SUDAH_URL_ENCODED@127.0.0.1:5432/pinjamakun
AUTH_SECRET=GANTI_DENGAN_SECRET_ACAK_MINIMAL_32_BYTE
TOKEN_HMAC_KEY=GANTI_DENGAN_SECRET_ACAK_YANG_BERBEDA
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=GANTI_USER_SMTP_JIKA_DIGUNAKAN
SMTP_PASSWORD=GANTI_PASSWORD_SMTP_JIKA_DIGUNAKAN
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Jika password database berisi karakter khusus, URL-encode bagian password pada `DATABASE_URL`.
Jangan menyalin secret contoh dari dokumentasi atau memakai secret yang pernah dikirim melalui chat.

Amankan file:

```bash
sudo chown root:pinjamakun /etc/pinjamakun/api.env
sudo chmod 0640 /etc/pinjamakun/api.env
```

Buat file environment khusus Docker agar password PostgreSQL tidak memakai nilai development bawaan:

```bash
sudo nano /etc/pinjamakun/postgres.env
```

Isi:

```dotenv
POSTGRES_PASSWORD=GANTI_PASSWORD_DATABASE
```

Gunakan password yang sama dengan bagian password pada `DATABASE_URL`, lalu amankan:

```bash
sudo chown root:pinjamakun /etc/pinjamakun/postgres.env
sudo chmod 0640 /etc/pinjamakun/postgres.env
```

Jangan commit kedua file tersebut ke Git.

## 7. Jalankan PostgreSQL

`compose.yaml` hanya mempublikasikan PostgreSQL pada loopback VPS sehingga port database tidak terbuka ke internet.

```bash
cd /opt/pinjamakun
sudo --preserve-env=PATH docker compose --env-file /etc/pinjamakun/postgres.env up -d postgres
sudo --preserve-env=PATH docker compose ps
sudo --preserve-env=PATH docker compose exec postgres pg_isready -U pinjamakun -d pinjamakun
```

> Schema dan migrasi aplikasi belum tersedia pada implementasi saat ini. Jalankan migrasi eksplisit setelah package database ditambahkan; jangan mengandalkan API melakukan migrasi otomatis saat startup.

## 8. Instal dependency dan build

```bash
cd /opt/pinjamakun
pnpm install --frozen-lockfile
pnpm check
```

Perintah tersebut menjalankan formatting check, lint, typecheck, tests, dan seluruh build. Jangan lanjutkan deploy jika gagal.

Berikan kepemilikan runtime kepada service account:

```bash
sudo chown -R pinjamakun:pinjamakun /opt/pinjamakun
```

Artefak utama:

- Dashboard: `/opt/pinjamakun/apps/dashboard/dist`
- API: `/opt/pinjamakun/apps/api/dist/server.js`
- Ekstensi Chromium: `/opt/pinjamakun/apps/extension/.output/chrome-mv3`
- Ekstensi Firefox: `/opt/pinjamakun/apps/extension/.output/firefox-mv2`

Ekstensi browser tidak dijalankan di VPS. Artefaknya harus diuji lalu didistribusikan melalui store browser atau mekanisme organisasi yang sesuai.

## 9. Jalankan API dengan systemd

Buat service:

```bash
sudo nano /etc/systemd/system/pinjamakun-api.service
```

Isi:

```ini
[Unit]
Description=PinjamAkun API
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=pinjamakun
Group=pinjamakun
WorkingDirectory=/opt/pinjamakun/apps/api
EnvironmentFile=/etc/pinjamakun/api.env
ExecStart=/usr/bin/node /opt/pinjamakun/apps/api/dist/server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=true
ReadWritePaths=/var/lib/pinjamakun
UMask=0077

[Install]
WantedBy=multi-user.target
```

Aktifkan service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pinjamakun-api
sudo systemctl status pinjamakun-api --no-pager
curl --fail http://127.0.0.1:3000/health
```

Respons yang diharapkan memiliki `status` bernilai `ok` dan `service` bernilai `pinjamakun-api`.

Lihat log tanpa mencetak environment:

```bash
sudo journalctl -u pinjamakun-api -n 100 --no-pager
```

Worker saat ini hanya berupa shell dan langsung selesai. Jangan membuat service worker persisten sebelum queue handler dan transactional outbox diimplementasikan.

## 10. Konfigurasi Nginx lokal

Buat virtual host:

```bash
sudo nano /etc/nginx/sites-available/pinjamakun
```

Isi konfigurasi berikut. Nginx hanya menerima koneksi dari VPS sendiri pada `127.0.0.1:8080`:

```nginx
server {
    listen 127.0.0.1:8080;
    server_name acc.fnoor.my.id;

    root /opt/pinjamakun/apps/dashboard/dist;
    index index.html;

    location /api/ {
        limit_except GET HEAD OPTIONS {
            deny all;
        }
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location = /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options DENY always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'" always;
}
```

Pembatasan method di atas sesuai kondisi repository yang hanya memiliki health endpoint. Hapus atau
persempit aturan tersebut secara sadar ketika endpoint mutation yang terautorisasi telah tersedia;
jangan membuka semua method secara global tanpa rate limit dan validasi CSRF/origin yang sesuai.

Perhatikan trailing slash pada `location /api/` dan `proxy_pass`. Konfigurasi tersebut mengubah `/api/health` menjadi `/health` pada Fastify.

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/pinjamakun /etc/nginx/sites-enabled/pinjamakun
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Uji origin lokal dengan Host header yang benar:

```bash
curl --fail -H 'Host: acc.fnoor.my.id' http://127.0.0.1:8080/health
curl --fail -H 'Host: acc.fnoor.my.id' http://127.0.0.1:8080/api/health
```

## 11. Instal dan konfigurasi Cloudflare Tunnel

Tambahkan repository resmi Cloudflare dan instal `cloudflared`:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install -y cloudflared
cloudflared --version
```

Autentikasikan VPS. Pada server headless, buka URL yang dicetak perintah ini pada browser lokal, login ke Cloudflare, lalu pilih zone `fnoor.my.id`:

```bash
cloudflared tunnel login
```

Buat named tunnel dan catat UUID yang ditampilkan:

```bash
cloudflared tunnel create pinjamakun-vps
cloudflared tunnel list
```

Perintah tersebut membuat file credential `<TUNNEL-UUID>.json` di `~/.cloudflared`. Pasang credential dan konfigurasi untuk service system-wide:

```bash
sudo install -d -m 0750 -o root -g root /etc/cloudflared
sudo install -m 0600 "$HOME/.cloudflared/<TUNNEL-UUID>.json" /etc/cloudflared/<TUNNEL-UUID>.json
sudo nano /etc/cloudflared/config.yml
```

Ganti `<TUNNEL-UUID>` pada nama file dan isi berikut:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /etc/cloudflared/<TUNNEL-UUID>.json

ingress:
    - hostname: acc.fnoor.my.id
        service: http://127.0.0.1:8080
        originRequest:
            connectTimeout: 10s
    - service: http_status:404
```

Catch-all `http_status:404` wajib menjadi aturan terakhir. Nginx tetap dipakai karena `cloudflared` meneruskan path tanpa menghapus prefix `/api/`, sementara aplikasi memerlukan rewrite `/api/health` menjadi `/health`.

Validasi konfigurasi dan rule:

```bash
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress rule https://acc.fnoor.my.id/api/health
```

Buat DNS route. Perintah ini membuat CNAME terkelola menuju `<TUNNEL-UUID>.cfargotunnel.com`; jangan membuat A/AAAA record ke IP VPS:

```bash
cloudflared tunnel route dns pinjamakun-vps acc.fnoor.my.id
```

Buat service systemd eksplisit agar lokasi konfigurasi dan credential tidak ambigu:

```bash
sudo nano /etc/systemd/system/pinjamakun-tunnel.service
```

Isi:

```ini
[Unit]
Description=Cloudflare Tunnel for PinjamAkun
After=network-online.target nginx.service pinjamakun-api.service
Wants=network-online.target
Requires=nginx.service

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config.yml tunnel run
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
```

Aktifkan tunnel:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pinjamakun-tunnel
sudo systemctl status pinjamakun-tunnel --no-pager
cloudflared tunnel info pinjamakun-vps
```

Cloudflare menyediakan HTTPS publik di edge dan koneksi tunnel terenkripsi menuju VPS. Karena origin hanya loopback, sertifikat Let's Encrypt pada VPS tidak diperlukan. Jangan gunakan mode SSL/TLS `Flexible` sebagai pola deployment untuk origin lain.

Uji endpoint publik:

```bash
curl --fail https://acc.fnoor.my.id/health
curl --fail https://acc.fnoor.my.id/api/health
```

Gunakan URL `https://acc.fnoor.my.id` untuk OAuth callback, pairing, dan komunikasi ekstensi. Jangan membuat route publik langsung ke port origin sebagai fallback.

## 12. Update deployment

Setelah perubahan baru sudah masuk ke branch `main`:

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
sudo systemctl restart pinjamakun-tunnel
sudo systemctl is-active --quiet pinjamakun-tunnel
curl --fail --retry 5 --retry-delay 2 https://acc.fnoor.my.id/health
```

Gunakan `--ff-only` agar server tidak membuat merge commit. Untuk zero-downtime deployment di masa depan, gunakan direktori release bertimestamp dan symlink `current` setelah API memiliki migrasi yang backward-compatible.

## 13. Backup dan restore PostgreSQL

Buat direktori backup yang terbatas:

```bash
sudo install -d -m 0700 /var/backups/pinjamakun
```

Backup manual:

```bash
cd /opt/pinjamakun
sudo docker compose exec -T postgres pg_dump -U pinjamakun -d pinjamakun -Fc > /var/backups/pinjamakun/pinjamakun-$(date +%F-%H%M).dump
```

Restore harus diuji pada database terpisah sebelum digunakan di produksi. Contoh prosedur destructive berikut hanya dijalankan saat maintenance dan setelah backup diverifikasi:

```bash
cd /opt/pinjamakun
sudo docker compose exec -T postgres dropdb -U pinjamakun --if-exists pinjamakun
sudo docker compose exec -T postgres createdb -U pinjamakun pinjamakun
sudo docker compose exec -T postgres pg_restore -U pinjamakun -d pinjamakun --clean --if-exists < /var/backups/pinjamakun/NAMA_BACKUP.dump
```

Simpan salinan backup terenkripsi di luar VPS dan tetapkan retention policy. Backup yang hanya berada pada VPS yang sama tidak melindungi dari kehilangan server.

## 14. Monitoring dan pemeriksaan rutin

Periksa service:

```bash
sudo systemctl is-active pinjamakun-api nginx docker
sudo systemctl is-active pinjamakun-tunnel
sudo docker compose -f /opt/pinjamakun/compose.yaml ps
curl --fail https://acc.fnoor.my.id/health
```

Periksa kapasitas:

```bash
df -h
docker system df
sudo du -sh /var/lib/docker /var/backups/pinjamakun
```

Jangan mengirim cookie values, token, private key, decrypted snapshot, isi file environment, atau header `Authorization` ke log dan monitoring.

## 15. Troubleshooting

### API tidak aktif

```bash
sudo systemctl status pinjamakun-api --no-pager
sudo journalctl -u pinjamakun-api -n 100 --no-pager
curl -v http://127.0.0.1:3000/health
```

Pastikan `/usr/bin/node` benar melalui `command -v node` dan build API tersedia.

### PostgreSQL tidak sehat

```bash
cd /opt/pinjamakun
sudo docker compose ps
sudo docker compose logs --tail=100 postgres
sudo docker compose exec postgres pg_isready -U pinjamakun -d pinjamakun
```

Jangan menyalin log database ke tiket publik sebelum memastikan tidak ada data sensitif.

### Nginx mengembalikan 502

```bash
sudo nginx -t
sudo ss -lntp | grep 3000
curl -v http://127.0.0.1:3000/health
```

Pastikan `pinjamakun-api` aktif dan menggunakan `API_HOST=127.0.0.1` serta `API_PORT=3000`.

### Cloudflare mengembalikan 502/1033

```bash
sudo systemctl status pinjamakun-tunnel --no-pager
sudo journalctl -u pinjamakun-tunnel -n 100 --no-pager
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
cloudflared tunnel info pinjamakun-vps
curl -v -H 'Host: acc.fnoor.my.id' http://127.0.0.1:8080/health
```

Pastikan UUID dan credential cocok, DNS route mengarah ke tunnel yang benar, Nginx aktif pada loopback port `8080`, dan VPS dapat membuat koneksi keluar pada port `7844`.

### Repository gagal di-update

```bash
cd /opt/pinjamakun
git status
git remote -v
git fetch origin
```

Jangan mengedit source code langsung pada VPS. Kembalikan perubahan lokal atau deploy ulang dari commit yang sudah tervalidasi.

## 16. Checklist produksi

- [ ] Zone `fnoor.my.id` memakai nameserver Cloudflare.
- [ ] `acc.fnoor.my.id` dirutekan ke named tunnel, bukan A/AAAA record IP VPS.
- [ ] SSH menggunakan key; login root dan password SSH dinonaktifkan jika memungkinkan.
- [ ] UFW hanya membuka SSH; port web, API, dan database tidak terbuka inbound.
- [ ] PostgreSQL hanya bind ke `127.0.0.1`.
- [ ] Nginx hanya listen pada `127.0.0.1:8080`.
- [ ] `pinjamakun-tunnel` aktif dan ingress config lolos validasi.
- [ ] Semua placeholder secret telah diganti dan berbeda satu sama lain.
- [ ] File environment memiliki permission `0640` atau lebih ketat.
- [ ] `pnpm check` berhasil pada commit yang di-deploy.
- [ ] API health check berhasil dari loopback dan domain publik.
- [ ] HTTPS Cloudflare aktif dan tidak ada origin fallback publik.
- [ ] Backup terenkripsi tersimpan di luar VPS dan restore pernah diuji.
- [ ] Log telah diperiksa agar tidak memuat data sensitif.
- [ ] Domain penggunaan dan kebijakan layanan tujuan telah ditinjau.
- [ ] Security review selesai sebelum cookie/sesi nyata diproses.
