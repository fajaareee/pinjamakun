# Panduan Deploy PinjamAkun ke VPS

Panduan ini men-deploy kondisi repository PinjamAkun saat ini pada VPS Ubuntu 22.04/24.04 menggunakan:

- Nginx sebagai reverse proxy dan static file server.
- Let's Encrypt untuk HTTPS.
- Node.js 22 dan pnpm 10 untuk API.
- Docker Compose untuk PostgreSQL.
- systemd untuk menjaga API tetap berjalan.

> **Status aplikasi:** repository saat ini masih berupa fondasi MVP. Dashboard dan endpoint health API dapat di-deploy, tetapi database/auth, pairing perangkat, undangan terenkripsi, worker queue, serta capture/apply cookie belum diimplementasikan. Jangan gunakan untuk data sesi nyata sebelum fitur tersebut selesai dan menjalani security review.

## 1. Prasyarat

Siapkan:

- VPS Ubuntu 22.04 atau 24.04 dengan minimal 1 vCPU dan 1 GB RAM.
- User non-root dengan akses `sudo`.
- Domain, misalnya `app.example.com`, yang A/AAAA record-nya sudah mengarah ke IP VPS.
- Port `22`, `80`, dan `443` dapat diakses.
- Akses baca ke repository `https://github.com/fajaareee/pinjamakun.git`.

Semua contoh menggunakan direktori `/opt/pinjamakun` dan domain `app.example.com`. Ganti keduanya sesuai lingkungan.

## 2. Persiapkan server

Masuk ke VPS, lalu perbarui paket:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git nginx certbot python3-certbot-nginx
```

Aktifkan firewall tanpa memutus SSH:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

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
PUBLIC_APP_URL=https://app.example.com
API_HOST=127.0.0.1
API_PORT=3000
DATABASE_URL=postgresql://pinjamakun:GANTI_PASSWORD_DATABASE@127.0.0.1:5432/pinjamakun
AUTH_SECRET=GANTI_DENGAN_SECRET_ACAK_MINIMAL_32_KARAKTER
TOKEN_HMAC_KEY=GANTI_DENGAN_SECRET_ACAK_YANG_BERBEDA
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=GANTI_USER_SMTP
SMTP_PASSWORD=GANTI_PASSWORD_SMTP
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

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
- Ekstensi Firefox: `/opt/pinjamakun/apps/extension/.output/firefox-mv3`

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

## 10. Konfigurasi Nginx

Buat virtual host:

```bash
sudo nano /etc/nginx/sites-available/pinjamakun
```

Isi dan ganti domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.example.com;

    root /opt/pinjamakun/apps/dashboard/dist;
    index index.html;

    location /api/ {
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
}
```

Perhatikan trailing slash pada `location /api/` dan `proxy_pass`. Konfigurasi tersebut mengubah `/api/health` menjadi `/health` pada Fastify.

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/pinjamakun /etc/nginx/sites-enabled/pinjamakun
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Uji HTTP sebelum meminta sertifikat:

```bash
curl --fail http://app.example.com/health
```

## 11. Aktifkan HTTPS

```bash
sudo certbot --nginx -d app.example.com
sudo certbot renew --dry-run
```

Uji endpoint publik:

```bash
curl --fail https://app.example.com/health
curl --fail https://app.example.com/api/health
```

Gunakan HTTPS untuk deployment produksi, OAuth callback, pairing, dan komunikasi ekstensi. Jangan mengizinkan fallback HTTP untuk data sensitif.

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
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://app.example.com/health
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
sudo docker compose -f /opt/pinjamakun/compose.yaml ps
curl --fail https://app.example.com/health
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

### Repository gagal di-update

```bash
cd /opt/pinjamakun
git status
git remote -v
git fetch origin
```

Jangan mengedit source code langsung pada VPS. Kembalikan perubahan lokal atau deploy ulang dari commit yang sudah tervalidasi.

## 16. Checklist produksi

- [ ] DNS mengarah ke IP VPS.
- [ ] SSH menggunakan key; login root dan password SSH dinonaktifkan jika memungkinkan.
- [ ] UFW hanya membuka port yang diperlukan.
- [ ] PostgreSQL hanya bind ke `127.0.0.1`.
- [ ] Semua placeholder secret telah diganti dan berbeda satu sama lain.
- [ ] File environment memiliki permission `0640` atau lebih ketat.
- [ ] `pnpm check` berhasil pada commit yang di-deploy.
- [ ] API health check berhasil dari loopback dan domain publik.
- [ ] HTTPS aktif dan renewal test berhasil.
- [ ] Backup terenkripsi tersimpan di luar VPS dan restore pernah diuji.
- [ ] Log telah diperiksa agar tidak memuat data sensitif.
- [ ] Domain penggunaan dan kebijakan layanan tujuan telah ditinjau.
- [ ] Security review selesai sebelum cookie/sesi nyata diproses.
