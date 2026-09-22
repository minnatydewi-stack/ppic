/**
 * ============================================================
 * KONFIGURASI DASHBOARD REKAP PRODUKSI
 * ============================================================
 * Edit bagian ini kalau ID spreadsheet atau nama tab berubah,
 * atau kalau kamu mau menambah bulan lain (buat spreadsheet baru
 * per bulan, lalu tambahkan objek baru di array MONTHS).
 *
 * PENTING (agar data bisa diambil dari browser / Vercel):
 * 1. Buka spreadsheet-nya.
 * 2. Klik "Bagikan" -> ubah akses jadi "Siapa saja yang memiliki link" (Viewer).
 *    (Kalau tidak, browser tidak akan bisa mengambil datanya.)
 * 3. Pastikan nama tab di bawah SAMA PERSIS (huruf besar/kecil,
 *    spasi, tanda "&") dengan nama tab asli di Google Sheets kamu.
 * ============================================================
 */

const CONFIG = {
  // Tab kategori yang akan ditampilkan sebagai menu di dashboard.
  // "sheet" = nama tab di Google Sheets. "sheet: null" artinya
  // ambil tab PALING KIRI / default (biasanya "Grand Total").
  categories: [
    {
      id: "ringkasan",
      label: "Ringkasan",
      sheet: null, // tab paling kiri (Grand Total / Rekap Total)
      isOverview: true,
      color: "#0f172a",
    },
    {
      id: "botol",
      label: "Rekap Botol",
      sheet: "Rekap Botol",
      color: "#2563eb",
    },
    {
      id: "thermocup",
      label: "Rekap Thermo Cup",
      sheet: "Rekap Thermo Cup",
      color: "#059669",
    },
    {
      id: "thermotray",
      label: "Rekap Thermo Tray & Lid",
      sheet: "Rekap Thermo Tray & Lid",
      color: "#d97706",
    },
    {
      id: "printing",
      label: "Rekap Printing",
      sheet: "Rekap Printing",
      color: "#7c3aed",
    },
    {
      id: "extruder",
      label: "Rekap Extruder",
      sheet: "Rekap Extruder",
      color: "#dc2626",
    },
  ],

  // Daftar bulan. Tambahkan objek baru di sini setiap ganti bulan/spreadsheet.
  months: [
    {
      key: "2026-09",
      label: "September 2026",
      spreadsheetId: "1FAbcl_l4uxs7KlGFuKRABs_C5HM-qvAiOcPmF-4DqZk",
    },
    // Contoh menambah bulan baru:
    // {
    //   key: "2026-10",
    //   label: "Oktober 2026",
    //   spreadsheetId: "GANTI_DENGAN_ID_SPREADSHEET_OKTOBER",
    // },
  ],
};
