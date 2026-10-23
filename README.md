# Inventaris IROS

Website inventaris sederhana dengan HTML, CSS, dan JavaScript. Tidak memerlukan instalasi framework, npm, API key, atau proses build.

## Penting sebelum digunakan

**Versi ini memakai penyimpanan lokal browser, bukan database bersama.**

Website bisa dibuka melalui GitHub Pages, tetapi data yang dimasukkan di laptop A tidak otomatis muncul di laptop B atau HP. Tidak ada login, hak akses pengguna, atau sinkronisasi cloud. Gunakan satu browser utama/PIC sebagai tempat pencatatan selama memakai versi ini.

Data awal benar-benar kosong. Tombol **Lihat contoh tampilan** membuka mode contoh yang terpisah; semua nama dan jumlah di mode tersebut adalah ilustrasi, bukan stok IROS. Perubahan mode contoh tidak disimpan dan tidak mengubah inventaris asli.

## Isi folder

```text
index.html   Halaman dan formulir website
style.css    Warna, tata letak, dan tampilan responsif
app.js       Pengelolaan barang, pencarian, stok, dan cadangan
.nojekyll    Penanda website statis untuk GitHub Pages
README.md    Petunjuk ini
```

Jangan mengubah nama `index.html`, `style.css`, atau `app.js` tanpa memperbarui referensinya. Ketiganya harus berada pada folder yang sama. Semua ikon ada di HTML, font menggunakan font sistem, dan tidak ada permintaan ke CDN atau layanan analitik.

## Unggah ke GitHub Pages

1. Ekstrak ZIP. Buat repository GitHub, misalnya `iros-inventaris`. Untuk akun GitHub Free, gunakan repository **Public**.
2. Upload **isi folder hasil ekstraksi**, bukan file ZIP-nya. Pastikan `index.html`, `style.css`, dan `app.js` langsung ada di bagian teratas repository, bukan di dalam folder tambahan. Sertakan `.nojekyll` dan README bila memungkinkan.
3. Buka repository → **Settings → Pages**. Pada **Build and deployment**, pilih **Source: Deploy from a branch**.
4. Pilih **Branch: main**, folder **/(root)**, lalu **Save**. Nama branch harus sesuai dengan branch tempat file diunggah.
5. Setelah penerbitan berhasil, buka alamat yang ditampilkan pada halaman Pages. Contoh pola alamat:

```text
https://USERNAME.github.io/iros-inventaris/
```

Tidak perlu terminal atau hosting backend untuk versi lokal ini. Belum ada deployment ke akun GitHub Anda yang dilakukan dalam paket ini.

**Jangan upload file cadangan JSON, data inventaris asli, kata sandi, atau kredensial ke repository publik.** Yang dipublikasikan cukup kode website. Situs GitHub Pages umumnya dapat diakses publik; website ini tidak menerapkan kontrol akses.

Jika halaman masih 404, periksa hasil deployment di tab Actions, branch sumber, nama `index.html`, dan posisi file pada folder root. Jika tampilan tidak rapi, pastikan `style.css` dan `app.js` ikut terunggah dengan huruf kecil yang sama.

## Cara menggunakan

### 1. Tambah barang

Klik **Tambah barang**, lalu isi nama, kategori, dan jumlah. Satuan memiliki nilai awal yang bisa diubah. Lokasi, kondisi, dan catatan tidak wajib diisi. Kondisi awal adalah **Perlu dicek**, bukan otomatis dianggap baik.

Kategori yang digunakan persis enam kelompok berikut:

| Kategori | Awalan kode |
| --- | --- |
| Robot dan kit | IROS-ROB |
| Komponen elektronik | IROS-ELK |
| Tools | IROS-TLS |
| Benda habis pakai | IROS-HBS |
| Kebutuhan kelas | IROS-KLS |
| Kebutuhan event | IROS-EVT |

Kode dibuat otomatis, misalnya `IROS-ELK-001`. Satu kode mewakili **satu baris inventaris**, tidak harus satu unit fisik. Sepuluh Arduino dengan tipe, lokasi, satuan, dan kondisi yang sama dapat dicatat sebagai satu baris berjumlah 10.

Pisahkan baris ketika kondisi atau lokasi berbeda. Untuk robot yang ingin dilacak sendiri, buat satu baris per robot. Jika mengubah kategori barang, aplikasi membuat kode baru dengan awalan kategori yang benar. Nomor lama tidak sengaja dipakai kembali setelah penghapusan.

Komponen di dalam kit tidak dihitung otomatis sebagai komponen lepas. Jangan memasukkan jumlah yang sama sekaligus ke stok kit dan stok komponen lepas bila itu akan membuat perhitungan ganda.

### 2. Temukan dan ubah

Pilih kategori melalui kartu atau menu di samping. Di HP, buka tombol menu di kiri atas. Pencarian bekerja pada nama, kode, lokasi, catatan, dan nama kategori dalam kategori yang sedang dipilih.

Klik **Ubah** untuk memperbarui detail. Klik **angka jumlah barang** untuk memilih **Tambah**, **Kurangi**, atau **Atur ulang**. Jumlah tidak boleh negatif; maksimal 3 angka desimal. Jumlah 0 berarti stok habis, bukan data terhapus.

Filter tersedia untuk kondisi baik, perlu dicek, rusak, stok habis, stok tersedia, dan perlu perhatian. “Perlu perhatian” mencakup stok 0 atau kondisi selain baik. Angka ringkasan menunjukkan jumlah jenis/baris, tidak menjumlahkan satuan berbeda seperti set, meter, dan unit.

Website ini belum menghitung peminjaman atau pengembalian secara terpisah. Jumlah adalah stok yang dicatat untuk lokasi tersebut, bukan perhitungan otomatis stok tersedia setelah dipinjam.

### 3. Hapus dengan hati-hati

Tombol tempat sampah selalu meminta konfirmasi. Sesaat setelah penghapusan, tersedia tombol **Batalkan** pada pemberitahuan. Untuk barang habis, lebih baik ubah jumlah menjadi 0 agar nama barang tetap tercatat.

### 4. Cadangkan setelah selesai mendata

Buka **Cadangan data → Unduh cadangan (.json)**. File ini berisi seluruh kategori, nomor kode, dan hingga 250 riwayat perubahan. Simpan di folder yang aman. Teks waktu cadangan mencatat dimulainya unduhan; pastikan file benar-benar selesai tersimpan.

**Unduh CSV** hanya mengekspor barang yang cocok dengan pencarian/filter saat itu, termasuk semua halaman hasilnya. CSV ditujukan untuk aplikasi spreadsheet, bukan untuk pemulihan data. Formatnya UTF-8 dengan BOM dan pemisah koma. Jika Excel menampilkan seluruh data dalam satu kolom, gunakan menu impor teks/CSV dan pilih pemisah koma. Angka desimal menggunakan titik dalam file.

Website ini **tidak mengimpor file Excel atau CSV**. Pemulihan hanya menerima file JSON dari aplikasi ini.

### 5. Pindah perangkat atau pulihkan data

Buka website di browser tujuan → **Cadangan data → Pilih file cadangan**. Periksa jumlah barang yang ditampilkan, lalu pilih salah satu cara:

- **Tambahkan barang baru:** ID atau kode yang sudah ada dilewati; tidak diperbarui, tidak dijumlahkan, dan tidak digandakan. Riwayat lama dari file sumber tidak digabungkan. Dua browser yang mendata sendiri bisa menghasilkan kode yang sama; benturan kode akan dilewati, meskipun nama barangnya berbeda.
- **Ganti seluruh data:** seluruh data barang menjadi sama dengan file cadangan. Gunakan ini untuk memindahkan versi inventaris terbaru dari satu browser utama ke browser tujuan. Selalu periksa file sumber sebelum mengganti.

Sebelum impor, aplikasi menyimpan salinan data lokal sebelumnya. Tombol **Pulihkan data sebelum impor** tersedia untuk kembali satu langkah selama salinan itu masih valid. Salinan tersebut berada di browser yang sama dan bukan pengganti cadangan file di luar browser.

Impor bukan sinkronisasi real-time. Untuk kerja bersama dari banyak perangkat dengan satu sumber data, perlu ditambahkan backend/database bersama dan aturan akses yang sesuai. Jangan membuat “login” yang hanya menyembunyikan tombol menggunakan JavaScript lalu menganggapnya sebagai pengamanan data bersama.

## Batas dan perlindungan data

- Maksimal 5.000 baris barang, 250 aktivitas terakhir, dan file impor maksimal 5 MB. Kuota penyimpanan browser bisa membatasi lebih awal. Aktivitas adalah catatan perubahan lokal, bukan audit pengguna yang tidak bisa diubah.
- Data mengikuti browser, profil, origin, dan namespace folder website. Mengganti browser, profil, alamat/domain, atau folder repository dapat membuat data lama tidak terlihat; pindahkan menggunakan cadangan. Menghapus data situs dapat menghapus inventaris.
- Jangan menggunakan mode incognito untuk data asli. Data privat dapat hilang ketika sesi privat berakhir.
- File `index.html` dapat dibuka langsung untuk melihat tampilan, tetapi perilaku penyimpanan pada alamat `file://` tidak dijamin sama di semua browser. Gunakan alamat GitHub Pages untuk operasional. Data pada file lokal tidak otomatis berpindah ke alamat Pages.
- Input pengguna dan isi JSON divalidasi. Teks ditampilkan sebagai teks, bukan HTML pengguna. Ekspor CSV menetralkan awalan formula berbahaya. Tidak ada rahasia atau API key di kode ini.
- Kesalahan penyimpanan tidak ditampilkan sebagai keberhasilan. Data korup tidak dihapus diam-diam; tersedia ekspor data mentah dan pemulihan dari cadangan.
- Pembaruan dari tab lain ditampilkan ulang. Formulir lama ditolak bila barangnya sudah berubah, untuk mengurangi risiko menimpa perubahan. Web Locks dipakai jika tersedia; browser tanpa fitur itu menggunakan pembacaan terbaru sebelum penulisan sinkron. Ini bukan database transaksi multi-pengguna.
- Penyimpanan lokal bukan enkripsi atau kontrol akses. Orang yang menggunakan profil browser yang sama bisa mengakses data; kode lain pada origin yang sama juga bukan batas keamanan terpisah.

## Catatan pengujian

Sintaks JavaScript telah diperiksa. Sebanyak 39 pemeriksaan alur antarmuka dan logika lulus dalam Chromium, mencakup tambah/ubah/hapus, perubahan stok, cadangan, penolakan impor duplikat, pemulihan, kegagalan penyimpanan, input berbahaya, dan mode contoh. Layout diperiksa pada lebar 320–1.920 px tanpa halaman melebar horizontal.

Lingkungan pengujian membatasi navigasi browser, sehingga pemeriksaan tersebut menggunakan DOM Chromium dengan fixture origin/history/penyimpanan. Ini tidak setara dengan uji produksi GitHub Pages atau uji lintas semua browser. Setelah upload, coba tambah satu barang uji, muat ulang halaman, unduh cadangan, lalu pulihkan sebelum memasukkan data asli dalam jumlah besar.

## Rujukan teknis

GitHub Docs — Configuring a publishing source for your GitHub Pages site:

```text
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
```

MDN — Window: localStorage property:

```text
https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
```
