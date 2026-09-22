# Dashboard Rekap Produksi

Dashboard statis (HTML/CSS/JS murni, tanpa build step) yang membaca data
langsung dari Google Sheets kamu secara live, lalu menampilkannya sebagai:

- **Overview** — kartu ringkasan 5 kategori (Botol, Thermo Cup, Thermo Tray & Lid,
  Printing, Extruder) + Grand Total bulan ini + grafik tren harian.
- **Kalender Harian** — grid tanggal 1–31, klik satu tanggal untuk melihat
  rincian produksi hari itu (6 panel: Botol, Thermo Cup, Thermo Tray, Printing,
  Extruder CS/E1, Extruder Diamat/E2 — persis format sheet harian kamu),
  lengkap dengan angka **Harian** dan **Akumulasi**.
- **Rekap per kategori** — tabel harian 1–31 + total, dan grafik tren, untuk
  masing-masing dari 5 sheet rekap kamu.

Karena tanpa build step, ini tinggal di-deploy langsung ke Vercel dari GitHub —
tidak perlu `npm install` apa pun.

## 1. Siapkan spreadsheet-nya

Dashboard mengambil data lewat endpoint publik Google Sheets (`gviz/tq`), jadi
spreadsheet **wajib** di-share sebagai:

> Share → General access → **Anyone with the link → Viewer**

Tanpa ini, dashboard akan menampilkan pesan error saat memuat data (browser
tidak bisa membaca sheet-nya).

## 2. Cocokkan `config.js`

Buka `config.js`, cek 3 hal ini sesuai spreadsheet kamu:

- `SPREADSHEET_ID` — sudah otomatis diisi dari link yang kamu kirim.
- `RECAP_SHEETS` — nama tab untuk 5 kategori. Sudah diisi default:
  `Rekap Botol`, `Rekap Thermo Cup`, `Rekap Thermo Tray & Lid`,
  `Rekap Printing`, `Rekap Extruder` — **ganti kalau nama tab kamu beda**.
- `DAYS_IN_MONTH` & `PERIOD_LABEL` — update tiap ganti bulan (mis. Oktober = 31 hari).
- `GRAND_TOTAL_SHEET` — dibiarkan kosong supaya otomatis ambil **tab paling kiri**
  di file (sesuai sheet "REKAP GRAND TOTAL PRODUKSI"). Kalau ternyata yang
  ke-load bukan itu, isi nama tab-nya secara manual di sini.

Sheet harian (tab `1`, `2`, … `31`) **tidak perlu dikonfigurasi** — dashboard
otomatis mengambil sheet dengan nama sesuai angka tanggal yang diklik.

## 3. Coba di komputer sendiri (opsional)

File ini murni statis, jadi cukup buka dengan server lokal apa saja, misalnya:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

lalu buka `http://localhost:8080`.

> Membuka `index.html` langsung lewat `file://` biasanya diblokir browser
> (CORS untuk `fetch`), jadi selalu jalankan lewat server lokal atau lewat
> Vercel.

## 4. Upload ke GitHub

```bash
git init
git add .
git commit -m "Dashboard rekap produksi"
git branch -M main
git remote add origin <url-repo-github-kamu>
git push -u origin main
```

## 5. Deploy ke Vercel

1. Login ke [vercel.com](https://vercel.com), **New Project**.
2. Import repo GitHub yang barusan kamu push.
3. Framework preset: pilih **Other** (tidak perlu build command / output
   directory apa pun — semua file statis akan langsung dilayani).
4. Deploy. Selesai — dashboard langsung live dan otomatis update tiap kali
   kamu isi spreadsheet (refresh otomatis tiap 5 menit, bisa diubah lewat
   `CONFIG.AUTO_REFRESH_MS`, atau klik tombol **Refresh** di kanan atas).

## Struktur file

```
index.html    → kerangka halaman & navigasi
styles.css    → tema visual (industrial/pabrik, dark)
config.js     → SEMUA pengaturan yang mungkin perlu kamu ubah
gviz.js       → pengambilan & parsing data dari Google Sheets
app.js        → routing & rendering dashboard
```

## Kalau parsing sheet harian meleset

Panel di modal kalender (`gviz.js` fungsi `parseDailySheet`) membaca sheet
harian dengan mencari judul section (mis. "Hasil Prod Botol Harian") lalu
mengumpulkan baris label+angka di sekitarnya, dan menganggap kata
"Akumulasi" sebagai pemisah antara data harian dan data kumulatif. Kalau ada
label yang terbaca aneh (misal tergabung/tidak lengkap), itu paling sering
karena tata letak kolom di sheet-mu sedikit berbeda dari template awal —
kamu bisa sesuaikan bagian `DAILY_SECTIONS` di `config.js` (kata kunci
pencarian judul) atau logika di `parseDailySheet` sesuai kebutuhan. Datanya
sendiri tetap benar (diambil langsung dari sel angka di sheet), yang bisa
meleset hanya label teks pendampingnya.
