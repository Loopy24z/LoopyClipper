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

Update lanjutan setelah aktivasi R2:
- R2 akhirnya aktif. Bucket loofy-clip berhasil dibuat (Standard, hint APAC). Akses publik r2.dev disabled. CORS diverifikasi untuk https://loopyclipper.vercel.app dan http://localhost:5174 dengan GET/HEAD/PUT dan ETag. Rule abort multipart 1 hari aktif; default provider 7 hari juga masih ada.
- Konfigurasi CORS yang dipakai tersimpan di docs/r2-cors.json (format Wrangler).
- R2_ACCOUNT_ID dan R2_BUCKET sudah diisi di .env.local. R2_ACCESS_KEY_ID dan R2_SECRET_ACCESS_KEY masih perlu token Object Read & Write khusus bucket ini. Pengguna diminta mengisinya langsung di file, bukan chat.
- Python 3.12.13 dan requirements processor dipasang di work/processor-venv; model Whisper base berada di work/whisper-models. WHISPER_CACHE di processor/.env menunjuk cache itu.
- Tes processor 7/7 lulus; ekspor sintetis 9:16, 1:1, 16:9 lulus. Transkripsi suara sintetis English menghasilkan 32 kata dan bahasa en; export captioned 14.29 detik H.264/AAC tersedia di work/render-smoke/speech-en-captioned.mp4. Ini tes lokal, belum cloud end-to-end atau tes akurasi Indonesian.
- Jalankan processor setelah R2 cloud tersambung: .\work\processor-venv\Scripts\python.exe processor/worker.py (dari folder source cloud). Worker belum dijalankan untuk mengambil job produksi.
- Commit 9111460 dipush dan dideploy: dpl_5igy6gy7LiNGQcFyrzrZ2Yx4mLNj READY. Live /login 200 dan setup notice terlihat; POST /auth/google 303 kembali ke not_configured; /api/account tanpa sesi 401.
- Tersisa: isi Google OAuth di Supabase, Site URL/redirect allowlist, isi kredensial R2 lalu upload ke Vercel dan redeploy; uji login nyata sebelum grant UUID admin. Git auto-deploy tetap perlu Vercel Login Connection.

Update koneksi clipping 2026-09-29:
- Pengguna sudah berhasil login Google. Kredensial R2 baru di .env.local valid: list HTTP 200, write/read signed URL dan CORS origin produksi lulus; objek diagnostik dibersihkan.
- Empat env R2 sudah disimpan ke Vercel production (dua key sebagai secret). Deployment terbaru dpl_2TAQu37xeK4TM8CL9d7Vi31Y87qB READY.
- Processor mengambil project YouTube yang antre, tetapi import-prepare gagal karena kredit tidak cukup. Belum ada bukti kegagalan download YouTube; jangan menyebut alur cloud clipping selesai.
- Akun pansydontcry@gmail.com diverifikasi langsung di auth.users: email confirmed, provider google, memiliki project. UUID akun ini kini masuk ADMIN_USER_IDS lokal dan Vercel sesuai permintaan admin sebelumnya; deployment terbaru membawa konfigurasi tersebut.
- Processor berjalan tersembunyi (PID saat mulai 9668) menggunakan work/processor-venv/Scripts/python.exe processor/worker.py; log lokal work/processor-cloud.log dan work/processor-cloud-error.log. Bergantung komputer tetap menyala. Verifikasi PID/heartbeat ulang saat melanjutkan.
- Langkah berikut: pengguna refresh website lalu Retry processing pada project lama. Pantau sampai transcript/suggestions siap, lalu uji ekspor cloud.
- .vercelignore ditambahkan supaya env lokal, cache model, venv, dan processor tidak ikut upload deployment web. Git auto-deploy masih belum tersambung.

Update preview video:
- Project YouTube selesai: transcript dan 5 draft clip tersedia. Source R2 226669741 byte, AV1 + AAC, durasi 1910.93 detik. Signed range GET 206 dan CORS origin produksi benar; pengguna tetap gagal playback setelah refresh.
- Editor diperbaiki agar video tidak meminta source sebelum project ready, lalu remount ketika ready. Build lulus; commit ec25362 dideploy READY sebagai dpl_tn78hAa45VkttKKVQukzX9k5RgyZ.
- Processor kini memilih H.264 lebih dahulu untuk YouTube dan mengonversi codec lain ke H.264/yuv420p + AAC sebelum upload. Validasi durasi <=0.5 detik dan batas 2 GB sebelum mengganti file lokal; 8 tes processor lulus termasuk konversi FFmpeg nyata.
- Worker diperbarui saat semua job complete, PID baru saat dimulai 24544. Verifikasi ulang sebelum menghentikan/restart.
- Backup source lama ada di work/preview-repair/original-av1.mp4. Konversi repair ke work/preview-repair/repaired.mp4 sedang dilakukan; periksa hasil dan upload R2 sebelum menyatakan playback selesai. Transkrip/5 klip tidak perlu dibuat ulang.
- Repair selesai: file H.264/yuv420p + AAC berhasil menggantikan source R2 (357775675 byte; durasi 1910.931995 detik, berbeda <0.001 detik). Size project diperbarui; transcript dan klip dipertahankan. Signed range GET ulang 206 dan ffprobe remote lulus. Playback aktual di browser pengguna masih perlu konfirmasi setelah reload.

Update framing 2026-10-02:
- Pengguna mengonfirmasi playback berhasil dan meminta video memenuhi frame vertical, tanpa letterbox.
- Default klip manual dan saran otomatis/refresh berubah dari contain ke cover (9:16, posisi tengah). Pilihan fit tetap tersedia dengan label yang menjelaskan bar; posisi crop horizontal tetap dapat disetel.
- Lima klip 9:16 contain milik pengguna di project 401944b1-69ec-49f8-973c-5e85072b2e7d diubah menjadi cover. Data framing sebelumnya dibackup ke work/backups/framing-*.json; transkrip, timing, caption, dan posisi dipertahankan.
- 23 tes Node lulus; uji FFmpeg nyata 1080x1920 memverifikasi piksel atas/tengah/bawah terisi video tanpa bar hitam pada fixture horizontal.

Update caption/pacing trial 2026-10-04:
- User meminta menerapkan versi yang bisa dicoba, tanpa menunggu tahapan persetujuan rancangan berikutnya.
- Enam preset caption, lima pilihan font (Lato/Anton dibundel dengan OFL), jumlah kata 1-6, posisi top/center/bottom, dan active-word highlight. Preview DOM dan ASS menggunakan timestamp yang dipetakan ke hasil edit.
- Clip options: Keep pauses, Natural, Balanced, Tight; kandidat jeda berbasis timestamp transkrip, bukan konfirmasi VAD. Wajib review bagian yang mungkin terlewat transkripsi; jangan klaim pemilihan semantik AI. Cut dapat dipulihkan satu per satu. Mengubah outer trim mereset daftar cut. Klip lama tidak diubah otomatis.
- Daftar segments tersimpan dan masuk snapshot ekspor. Worker trim/concat audio-video sebelum caption, mendukung video tanpa audio dan progress berdasarkan durasi output. X-Render-Version:2 mencegah worker lama mengonsumsi job render baru.
- Highlight kini mengikuti kandidat batas kalimat/jeda dan memilih interval yang tidak bertumpuk; refresh tetap eksplisit dan mempertahankan klip reviewed.
- Tes: 25 Node lulus, 10 Python lulus; FFmpeg nyata menguji cut dan durasi pada ketiga rasio serta video tanpa audio. Build production lulus. Pemeriksaan browser interaktif dengan akun pengguna dan ekspor cloud nyata belum dilakukan untuk versi ini.
- Worker dinyalakan tersembunyi dengan PID awal 16072; heartbeat produksi kembali aktif. Log work/processor-v2.log dan work/processor-v2-error.log. Bergantung komputer tetap menyala; verifikasi PID saat melanjutkan.
- Kredit/langganan yang lama tetap berlaku; pembelian masih disabled, belum ada payment gateway. Pertanyaan mode pembayaran belum dijawab. Implementasi ini tidak mengaktifkan tagihan atau paket berbayar.
- Belum diterapkan dari spec besar: VAD terpersisten, cue editor individual, rendered-preview reuse, semantic model, checkout otomatis. Ini versi uji caption dan pacing yang terbatas, bukan penyelesaian seluruh spec.

Update fundamental clip 2026-10-05:
- User menetapkan hook 3 detik, pacing, caption dinamis, 9:16 dan headline sebagai komponen dasar.
- Ranking hook kini melihat sinyal pertanyaan/kontras/manfaat pada tiga detik pembuka saja. Tetap heuristik transkrip, bukan semantic model atau prediksi viral. Tidak menyusun ulang ucapan.
- Saran baru/refresh memakai Natural pause cuts, 9:16 cover, caption active-word Lato dan headline kutipan pembuka. Reviewed clips tidak diubah otomatis.
- Clip options memiliki Apply vertical clip setup untuk klip lama, Preview first 3 seconds, serta headline editable maksimal 80 karakter, on/off dan durasi 1-10 detik. Headline dihitung pada output timeline dan ikut burn-in, terpisah dari toggle caption; top captions diberi jarak saat headline aktif.
- Render capability naik ke 3. Worker v1/v2 tidak dapat mengambil job headline. Worker v3 dimulai tersembunyi, PID awal 27300, log work/processor-v3*.log; verifikasi heartbeat sebelum menyatakan online pada sesi berikutnya.
- Verifikasi: 26 tes Node dan 11 Python lulus, build production lulus. FFmpeg nyata tiga rasio mencakup overlay headline dan cuts. Browser pengguna dan ekspor cloud nyata belum diuji untuk perubahan ini.
- Pemilihan bagian tidak penting secara semantik belum diterapkan; pemotongan otomatis masih berdasarkan jeda transkrip. Langganan berbayar tetap belum diaktifkan.

Update judul opsional 2026-10-05:
- Sesuai koreksi pengguna, headlineEnabled default false pada saran dan Apply vertical clip setup. Judul klip untuk library terpisah dari optional video title.
- UI: Show title in video toggle, Video title text editable, durasi; Fill from transcript tidak otomatis mengaktifkan overlay.
- Lima headline otomatis milik akun pengguna dimatikan setelah dicocokkan dengan headlineFromWords; empat klip lain dipertahankan. Backup data awal di work/backups/optional-headline-*.json. File ekspor lama tidak diubah: perlu ekspor ulang untuk menghilangkan judul yang sudah dibakar ke video.
- 26 tes Node dan production build lulus. Renderer tidak berubah.

Update template/editor 2026-10-05:
- My templates menyimpan maksimal 20 template per akun di Supabase, dengan create/apply/replace-rename/delete dan undo apply. Template menyimpan style caption, rasio/fit/crop dan visibility/durasi judul; tidak menyalin transcript, headline text, nama klip, caption override, atau segments/timing.
- Migration 0002_clip_templates.sql sudah diterapkan. RLS aktif, akses browser direct dicabut; API membatasi setiap operasi ke owner. Batas jumlah diserialisasi dengan lock akun; nama unik case-insensitive per owner. Workspace deletion juga menghapus template.
- Caption preset menjadi 12: tambahan Neon cyan, Golden hour, Editorial, Rose box, Podcast, Center stage. Menggunakan efek/font renderer yang sudah didukung; renderer tidak berubah.
- Editor mendapat komponen editor-presets.tsx: kartu preview gaya caption, indikator selected, kategori style, panel saved templates dan konfirmasi hapus inline. Judul video tetap opt-in.
- Verifikasi 28 tes Node dan production build lulus, termasuk CRUD/isolation/cap template, penyaringan konten/timing dan validasi 12 preset. Tampilan browser interaktif belum diverifikasi pada sesi ini.
