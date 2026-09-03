# ADR-001: E2EE tanpa server escrow

- **Status:** diterima untuk MVP
- **Tanggal:** 2026-09-03

## Keputusan

Setiap instalasi ekstensi membuat key pair lokal. Setiap versi snapshot memakai random data-encryption key dan authenticated metadata. Data key disegel untuk setiap perangkat penerima yang berwenang. Server menyimpan public key, ciphertext, dan key envelope saja.

## Konsekuensi

- Server compromise tidak langsung membuka plaintext snapshot.
- Perangkat baru memerlukan persetujuan perangkat yang sudah berwenang.
- Kehilangan semua perangkat berarti kehilangan akses; server recovery tidak tersedia.
- Crypto protocol harus versioned dan menjalani review independen sebelum produksi.
