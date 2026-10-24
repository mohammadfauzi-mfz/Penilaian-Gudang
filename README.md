# Penilaian Gudang (Android)

Aplikasi inspeksi gudang: 8 aspek / 46 butir (SB=5, BA=4, S=3, BU=2) sesuai Excel
*Monitoring Penilaian Gudang Kaltim 2026*. Skor butir dan aspek memakai rumus Excel
(rata-rata poin; PKS tanpa aspek pupuk = 40 butir).

- Nilai per butir + foto + catatan, tersimpan di HP (offline), draf otomatis
- Bagikan **Excel** (rumus hidup, format monitoring) dan **PowerPoint** (mengikuti contoh "Warehouse Performance")
- Data terkirim ke **Firebase Firestore**; tab **Tren** di aplikasi dan **dashboard web** membaca data yang sama
- Pengaturan > Impor: memuat nilai Jan–Agu 2026 dari Excel Anda agar tren langsung terisi

## Langkah pasang (sekali)
1. **Firebase**: buat proyek di console.firebase.google.com → Build > Authentication > Sign-in method → aktifkan **Email/Password** (bukan Anonymous).
   Build > Firestore Database > Create (mode production) → tab Rules → tempel isi `firebase/firestore.rules` → Publish.
   Project settings > Your apps > Web app → catat `apiKey` dan `projectId`.
2. **GitHub**: unggah isi folder ini ke repo baru. Settings > Secrets and variables > Actions → tambah
   `FIREBASE_API_KEY` dan `FIREBASE_PROJECT_ID`.
3. **APK**: tab Actions > *Build APK* > Run workflow. Unduh artifact `PenilaianGudang-apk` (file .apk, sudah bertanda tangan tetap sehingga versi baru menimpa yang lama).
4. **Dashboard web**: Settings > Pages > Source: *GitHub Actions*; jalankan workflow *Dashboard*. Alamatnya muncul di hasil workflow.
5. Tanpa secrets pun bisa: isi apiKey/projectId di aplikasi (Atur > Database).

## Akun, peran, dan area
**Cara mudah:** login sebagai admin, lalu Pengaturan > Kelola pengguna > Tambah pengguna (nama pengguna, kata sandi awal, peran, area). Admin juga bisa mengubah peran/area dan menonaktifkan akun. Pengguna dapat mengganti kata sandinya sendiri (Pengaturan > Akun). Lupa kata sandi: reset lewat Firebase Console (Authentication > Users). **Admin pertama** tetap dibuat lewat Console seperti di bawah.

**Cara manual lewat Firebase Console** (tetap bisa dipakai):
Peran: **admin** (semua PT/estate + kelola PT & Estate/PKS di Pengaturan), **supervisi** (lihat semua, tanpa input),
**user** (input dan lihat hanya estate/PKS miliknya).

Untuk setiap orang:
1. Authentication > Users > Add user. Email: `<nama>@pg.local` (di aplikasi cukup ketik `<nama>`), isi kata sandi. Salin **User UID**-nya.
2. Firestore Database > Start collection `users` (sekali) > Document ID = **User UID** tadi, dengan field:
   - `name` (string) mis. `Budi BAS`
   - `role` (string) `admin` / `supervisi` / `user`
   - `locs` (array of string) mis. `BA1`, `MB1`. Hanya dipakai untuk `user`; kode sama dengan kode Estate/PKS di aplikasi.
3. Akun yang belum punya dokumen `users` bisa login tetapi tidak dapat membaca apa pun.
4. **Admin pertama**: buat akun dan dokumen `users` dengan `role=admin`, lalu login di aplikasi. Daftar PT & Estate/PKS bawaan otomatis
   dikirim ke database saat admin pertama login; setelah itu perubahan dari Pengaturan dipakai semua HP.
Ganti peran atau area: ubah dokumen `users` lalu minta pengguna menekan Sinkronkan (atau buka ulang aplikasi).

## Foto ke Google Drive (Google Apps Script)
Foto penilaian diunggah ke Drive Anda (folder `Penilaian Gudang - Foto/PT/Estate/Periode`), bukan ke Firebase.
HP lain bisa melihatnya (sesuai area) dan memasukkannya ke PowerPoint.
1. Buka script.google.com > **Proyek baru**. Tempel isi `drive/Code.gs` (ganti seluruh isi file).
2. **Project Settings > Script properties > Add**: `API_KEY` = Web API key Firebase, `PROJECT_ID` = Project ID Firebase.
3. **Deploy > New deployment > Web app**: *Execute as* = **Me**, *Who has access* = **Anyone**. Deploy, setujui izin Drive dan koneksi eksternal
   (di layar peringatan: Advanced > Go to project). Salin **Web app URL** (berakhir `/exec`).
4. Di aplikasi (login admin): Pengaturan > **Foto ke Google Drive** > tempel URL > **Simpan dan uji**. URL otomatis dipakai semua HP.
5. Setelah mengubah kode skrip, buat *New version* pada deployment yang sama agar URL tidak berubah.
Keamanan: skrip hanya menerima permintaan dengan token login Firebase yang valid, dan memeriksa peran/area lewat Firestore.
Foto yang diganti atau dihapus di aplikasi tidak menghapus berkas lama di Drive (bisa dibersihkan manual).

## Uji lokal
`npm install && npm test` (build dengan stub plugin + uji Chromium ujung-ke-ujung dengan Firebase tiruan).
