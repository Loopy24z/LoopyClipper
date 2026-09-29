# Catatan migrasi cloud

Source cloud berada di folder ini. Source localhost lama tetap terpisah.

Selesai di source:
- Next.js untuk Vercel; Supabase Google PKCE dan Postgres dengan RLS pada tabel aplikasi.
- Kredit harian WIB, admin berdasarkan UUID terverifikasi, subscription manual (default nonaktif).
- Upload multipart langsung ke private R2, URL media bertanda tangan, processor Python memakai transport tanpa membocorkan token ke storage.
- Transaksi debit/refund, reservasi storage global 5 GiB, job lease dengan row locks, retry penghapusan.
- Dokumen setup, contoh env tanpa secret, migration runner, CI.

Verifikasi lokal:
- 21 tes JavaScript/TypeScript lulus (PGlite, API, auth helper, storage, domain).
- 7 tes Python lulus (caption dan transport worker).
- Next production build lulus.
- FFmpeg smoke: 9:16, 1:1, 16:9; H.264 + AAC. Video sintetis, bukan tes akurasi transkripsi.

Belum terverifikasi di provider:
- Login Google nyata, R2 CORS dan upload live, transkripsi English/Indonesian dari cloud, unduhan YouTube eksternal.
- Kredensial/provider environment belum tersedia. Ikuti docs/DEPLOY.md.
- Supabase Auth identity deletion/backup expiry dan benchmark concurrency tetap pekerjaan launch.

Keputusan implementasi: reservasi failed export dipertahankan sampai project dihapus, karena output R2 mungkin sudah selesai sebelum koneksi worker terputus. Lebih konservatif terhadap storage daripada membebaskan kuota yang belum terbukti kosong.


Update deployment 2026-09-28:
- Production: https://loopyclipper.vercel.app (Vercel project pansydontcry-5699/loopyclipper).
- Deployment READY; GET / redirects to /login with HTTP 200. GET /api/account without session returns 401.
- Login page correctly reports Supabase configuration missing. Upload/processing not yet connected to real cloud services.
- GitHub main includes fed1d26: Node 22 test runner compatibility and Vercel JSON BOM fix. GitHub Actions run 36405086751 succeeded.
- Vercel CLI authenticated. Git automatic deployment NOT connected: Vercel requires linking the GitHub account under Login Connections. Current deployment was sent directly by CLI.
- Next: configure Supabase Google OAuth/Postgres migration, private R2 CORS/credentials, PROCESSOR_TOKEN and worker. Do not place secrets in this document or git.


Update Supabase/Vercel 2026-09-29:
- Supabase project loopyclipper: vrimtaefxeqavlfkhuyw, Singapore. Organization: LoopyClipper.
- Migrasi 0001_loofy.sql sudah diterapkan. Verifikasi live: 14 tabel public, 14 RLS aktif, 0 browser grants untuk anon/authenticated.
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dan DATABASE_URL sudah disimpan di Vercel production. DATABASE_URL disimpan sebagai secret setelah izin eksplisit pemilik.
- Deployment dpl_HE5iWqzB26Aa91Vrq6Py9St6e5Aw READY di https://loopyclipper.vercel.app. GET /login 200; GET /api/account tanpa login 401.
- Provider Google masih disabled (diperiksa lewat Auth settings). Tombol login sekarang tampil tetapi login Google belum dapat digunakan sampai OAuth Client ID/Secret diisi di Supabase.
- Callback site_url/redirect sudah disiapkan lokal tetapi BELUM dipush; config diff juga mendeteksi perubahan Twilio yang tidak diminta, sehingga dihentikan. Selesaikan hanya site_url dan redirect allowlist melalui dashboard/API tanpa mengubah SMS.
- R2 belum terhubung dan worker belum dijalankan. CLI Cloudflare belum authenticated pada pemeriksaan terakhir.
- File supabase/config.toml dan supabase/.temp diabaikan Git karena merupakan konfigurasi deployment lokal. Jangan commit credential.

Update login dan clipping 2026-09-29:
- Wrangler device login berhasil. Akun Cloudflare aktif di CLI: verifmlbb629@gmail.com, account b42389e0d82517d9f6c2543d0330b4e4.
- R2 bucket list masih gagal dengan code 10042 (Please enable R2), termasuk pemeriksaan ulang setelah pengguna menyatakan sudah aktif. Konfirmasi akun dashboard dan apakah tombol Create bucket sudah tersedia. Belum membuat bucket atau menjalankan worker cloud.
- Halaman login dan POST Google kini mengecek provider remote. Provider disabled menampilkan setup-needed; gangguan koneksi menampilkan pesan retry. Tidak ada bypass identitas/admin.
- 23 tes Node lulus; panduan docs/AUTH.md berisi origin/callback produksi yang tepat. Login Google nyata tetap menunggu OAuth Client ID/Secret di Supabase dan URL Configuration.
