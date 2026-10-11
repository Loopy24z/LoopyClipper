# Koneksi publikasi LoofyAI (beta pribadi)

## Status fitur

Panel **Publish to social** ada pada hasil ekspor yang selesai, termasuk Render history.
Konektor native tersedia untuk YouTube, Facebook Page Reels dan Instagram Reels melalui Facebook Login.
Belum ada kredensial platform pada instalasi ini: pengiriman live belum diuji.
TikTok ditampilkan sebagai belum tersedia; tidak ada tombol upload palsu atau konektor tidak resmi.

Alur: ekspor MP4 > buka panel > periksa video > pilih akun > edit copy > pilih visibilitas/audiens > konfirmasi > Send.
Antrean tetap tersimpan di Supabase. Worker Windows harus hidup. Tidak membutuhkan Docker atau layanan penerbitan berbayar.
Satu hasil ekspor/platform hanya punya satu operasi. Network retry tidak membuat posting baru.
Jika terputus setelah mulai mengirim, status **review** meminta pemeriksaan akun tujuan; sistem tidak mengulang kirim secara otomatis.
Status complete berarti platform telah mengonfirmasi upload/publish, bukan jaminan langsung muncul di feed.

## Tempat konfigurasi

1. Salin nama variabel publikasi dari `processor/.env.example` ke **processor/.env** (bukan `.env.local` frontend).
2. Isi `PUBLISH_OWNER_ID` dengan UUID akun admin Supabase yang sudah masuk di `ADMIN_USER_IDS` server.
3. Isi hanya konektor yang akan dipakai. Biarkan yang lain kosong.
4. Restart worker setelah tidak ada pekerjaan berjalan. Koneksi dicek dari API platform dan nama akun muncul di panel dalam satu siklus polling.

Token hanya disimpan di file lokal yang diabaikan Git. Jangan gunakan awalan NEXT_PUBLIC, commit token, atau mengirim token lewat chat.
Panel hanya memungkinkan akun admin pemilik konfigurasi menggunakan konektor. Pengguna lain tetap dapat mengunduh MP4.
Ini belum sistem OAuth multi-user; perlu alur OAuth per pengguna dan penyimpanan token terenkripsi untuk beta publik.

## YouTube

1. Google Cloud Console: buat/pilih project, aktifkan **YouTube Data API v3**.
2. Konfigurasi OAuth consent dan tambahkan akun sendiri sebagai test user bila masih testing.
3. Buat OAuth client. Gunakan alur OAuth resmi untuk memberikan dua scope: `https://www.googleapis.com/auth/youtube.upload` dan `https://www.googleapis.com/auth/youtube.readonly`.
4. Dapatkan refresh token melalui alur OAuth dengan `access_type=offline`; Google OAuth Playground dapat dipakai untuk setup pribadi dengan opsi **Use your own OAuth credentials** dan redirect URI Playground yang terdaftar. Setelah setup, simpan kredensial hanya di processor/.env.
5. Isi `PUBLISH_YOUTUBE_CLIENT_ID`, `PUBLISH_YOUTUBE_CLIENT_SECRET`, `PUBLISH_YOUTUBE_REFRESH_TOKEN`, `PUBLISH_YOUTUBE_CHANNEL_ID`.
6. Restart worker, pastikan nama channel benar. Uji pertama dengan video milik sendiri dan visibilitas **Private**.

Login Google aplikasi hanya untuk autentikasi LoofyAI. Izin upload YouTube harus diberikan terpisah.
Token aplikasi dalam mode testing dapat memiliki masa berlaku terbatas; bila koneksi hilang, lakukan otorisasi ulang.
Worker memakai upload resumable dengan potongan 8 MiB, tidak memuat seluruh MP4 di RAM.
Dokumentasi: https://developers.google.com/youtube/v3/docs/videos/insert
OAuth: https://developers.google.com/identity/protocols/oauth2/web-server

## Facebook Page Reels

1. Siapkan Facebook Page yang dikelola akun sendiri dan aplikasi Meta yang mendukung Facebook Login.
2. Dapatkan Page access token dengan izin yang dibutuhkan endpoint Reels, termasuk `pages_manage_posts` dan `pages_read_engagement`. Gunakan alur token resmi Meta dan periksa masa berlaku/izin.
3. Isi `PUBLISH_META_VERSION` dengan versi Graph API yang masih didukung oleh aplikasi (format vNN.0), `PUBLISH_FACEBOOK_PAGE_ID`, `PUBLISH_FACEBOOK_TOKEN`.
4. Worker memverifikasi ID dan nama Page. Konektor ini tidak mendukung profil Facebook pribadi.
5. Ekspor 9:16 berdurasi 3-90 detik untuk jalur Reels ini. Panel menyatakan secara eksplisit bahwa posting akan publik.

Dokumentasi resmi: https://developers.facebook.com/docs/video-api/guides/reels-publishing/
Koleksi resmi Meta: https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api

## Instagram Reels

1. Gunakan akun Instagram **Business/Creator**, terhubung ke Facebook Page. Implementasi ini memakai **Instagram API with Facebook Login**, bukan jalur Instagram Login.
2. Siapkan token yang berwenang untuk akun tersebut dengan `instagram_basic`, `instagram_content_publish`, dan `pages_read_engagement`, serta persyaratan tambahan per konfigurasi Meta.
3. Isi `PUBLISH_META_VERSION`, `PUBLISH_INSTAGRAM_ACCOUNT_ID` (ID numerik akun professional, bukan username), `PUBLISH_INSTAGRAM_TOKEN`.
4. Worker memverifikasi username, membuat media container dari URL R2 bertanda tangan, menunggu FINISHED, lalu menerbitkannya.
5. Ekspor 9:16 dan pastikan audio/media memenuhi aturan platform. Post akan publik; tinjau sebelum mengirim.

Untuk Meta, storage R2 tetap privat. URL ekspor sementara hanya diberikan kepada platform setelah konfirmasi pengguna.
Akses token, review aplikasi, jenis akun, dan batas media ditentukan Meta. App role/tester tidak setara dengan akses publik untuk semua pengguna.
Dokumentasi: https://developers.facebook.com/docs/instagram-platform/content-publishing
Koleksi resmi Meta: https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00

## TikTok: tahap terpisah yang belum aktif

Direct Post yang belum diaudit terbatas ke SELF_ONLY. Pedoman juga menyatakan utilitas internal untuk akun sendiri/tim tidak memenuhi intended use untuk jalur ini.
Jangan menganggap token saja membuat publikasi publik disetujui.
Untuk peluncuran yang memenuhi syarat diperlukan:
- aplikasi developer yang sesuai, otorisasi creator dan review/audit;
- query creator_info, nama akun, pilihan privasi tanpa default, kontrol Comment/Duet/Stitch, disclosure komersial, consent serta preview;
- verifikasi domain/prefix media untuk PULL_FROM_URL karena ekspor berada di storage server;
- polling status atau webhook dan penanganan batas creator.

Bucket R2 jangan dibuat publik hanya untuk melewati persyaratan tersebut. Untuk sekarang gunakan Download MP4 lalu unggah melalui aplikasi TikTok.
Panduan resmi: https://developers.tiktok.com/docs/en/content-sharing-guidelines

## Batas pengujian

Uji otomatis menggunakan database PostgreSQL lokal emulasi dan respons platform mock; tidak memposting konten ke akun sungguhan.
Pengujian live tiap konektor masih memerlukan kredensial pengguna, review pengaturan dan ekspor yang pengguna pilih untuk dikirim.
Menghapus project menghapus antrean lokal, tetapi tidak menghapus video yang sudah terkirim ke platform. Hapus video tersebut dari platform terkait.
