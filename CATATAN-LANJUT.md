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
- Login Google nyata, R2 CORS dan upload live, deploy Vercel, transkripsi English/Indonesian dari cloud, unduhan YouTube eksternal.
- Kredensial/provider environment belum tersedia. Ikuti docs/DEPLOY.md.
- Supabase Auth identity deletion/backup expiry dan benchmark concurrency tetap pekerjaan launch.

Keputusan implementasi: reservasi failed export dipertahankan sampai project dihapus, karena output R2 mungkin sudah selesai sebelum koneksi worker terputus. Lebih konservatif terhadap storage daripada membebaskan kuota yang belum terbukti kosong.
