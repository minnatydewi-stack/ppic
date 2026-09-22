# Dashboard Rekap Produksi

Dashboard statis (HTML/CSS/JS, tanpa build step) yang mengambil data
langsung dari Google Sheets kamu secara real-time, lalu menampilkan:

- Ringkasan KPI (total per kolom)
- Kalender 1–31 per bulan (heatmap warna sesuai nilai produksi harian, klik untuk detail)
- Grafik tren harian
- Tabel data lengkap
- Rekap bulanan lintas kategori (Botol, Thermo Cup, Thermo Tray & Lid, Printing, Extruder)

## 1. Wajib dilakukan di Google Sheets

1. Buka spreadsheet **Rekap Produksi**-nya.
2. `File > Bagikan > Ubah menjadi "Siapa saja yang memiliki link"` (minimal **Viewer**).
   Ini wajib — kalau tidak, browser tidak bisa mengambil datanya sama sekali.
3. Cek nama tab-nya harus **sama persis** (besar-kecil huruf, spasi, tanda `&`)
   dengan yang ada di `config.js`. Nama tab yang dipakai saat ini:
   - `Rekap Botol`
   - `Rekap Thermo Cup`
   - `Rekap Thermo Tray & Lid`
   - `Rekap Printing`
   - `Rekap Extruder`
   - Tab paling kiri (misal "Grand Total" / "Rekap Total") dipakai otomatis
     untuk tab **Ringkasan** — tidak perlu diganti namanya, cukup pastikan
     dia tetap tab paling kiri, atau isi field `sheet` di `config.js` dengan
     nama tab tersebut.

   Kalau nama tab kamu berbeda, edit di `config.js` pada bagian `categories`.

## 2. Cara kerja parsing data (penting untuk dipahami)

Script (`script.js`) **tidak** menebak posisi kolom secara hard-code.
Untuk setiap tab, script akan:
1. Mencari baris header yang mengandung kata "Tanggal" atau "Hari".
2. Membaca semua nama kolom di baris itu (misalnya "Output Actual (Pcs)",
   "Bahan (Kg)", dst) — apa pun nama & jumlah kolomnya.
3. Membaca baris-baris di bawahnya selama kolom pertama berisi angka 1–31.
4. Membaca baris "TOTAL" kalau ada (kalau tidak ada, dihitung otomatis
   dari penjumlahan harian).

Karena itu, dashboard ini otomatis menyesuaikan walau setiap tab
(Botol, Thermo Cup, Printing, Extruder, dst) punya kolom yang berbeda-beda.
Kalau ada tab yang gagal terbaca, akan muncul pesan error yang menyebutkan
sheet mana yang bermasalah dan kemungkinan sebabnya (nama tab salah / belum
dibagikan publik / format header berbeda).

## 3. Menambah bulan baru

Setiap bulan biasanya jadi spreadsheet baru. Cukup tambahkan entri baru
di `config.js` bagian `months`:

```js
months: [
  { key: "2026-09", label: "September 2026", spreadsheetId: "ID_SEPTEMBER" },
  { key: "2026-10", label: "Oktober 2026",   spreadsheetId: "ID_OKTOBER" },
],
```

Dashboard akan otomatis menampilkan dropdown bulan di kanan atas.

## 4. Jalankan lokal

Tidak perlu install apa pun — cukup buka `index.html` langsung di
browser, atau jalankan server statis sederhana:

```bash
npx serve .
```

## 5. Deploy ke GitHub + Vercel

1. Buat repo baru di GitHub, upload semua isi folder ini
   (`index.html`, `style.css`, `script.js`, `config.js`, `vercel.json`).
2. Buka [vercel.com](https://vercel.com) → **New Project** → Import repo
   tersebut.
3. Framework preset pilih **Other** (tidak perlu build command, tidak
   perlu install command) — karena ini situs statis murni.
4. Klik **Deploy**. Selesai — dashboard langsung online dan datanya
   akan selalu real-time mengikuti isian Google Sheets kamu.

## 6. Kalau muncul error CORS / gagal fetch di Vercel

Jika setelah deploy dashboard menunjukkan error gagal memuat data
(padahal sudah "Anyone with the link"), coba alternatif ini:
1. Di Google Sheets: `File > Share > Publish to web`, pilih sheet yang
   error tadi, format **CSV**, klik Publish.
2. Ambil gid dari URL publish tersebut, lalu di `config.js` ganti
   fetch URL sesuai kebutuhan (hubungi developer/Claude lagi kalau
   butuh bantuan menyesuaikan `script.js` ke pola URL publish ini).

## Batasan yang perlu diketahui

- Dashboard mengasumsikan setiap tab rekap punya pola yang sama dengan
  tab Grand Total: baris header berisi "Tanggal"/"Hari", lalu baris
  data 1–31, lalu baris "TOTAL". Kalau layout tab Printing/Extruder-mu
  ternyata beda total (misal headernya dua baris, atau tanggal ada di
  kolom lain), beberapa tab mungkin perlu penyesuaian kecil di
  `analyzeSheet()` pada `script.js`.
- Karena data diambil langsung dari browser pengguna (client-side),
  jangan taruh data sensitif/rahasia di spreadsheet ini kalau link
  dashboard-nya dibagikan ke publik.
