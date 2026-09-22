/**
 * config.js
 * -------------------------------------------------------------
 * Semua pengaturan yang mungkin perlu diubah ada di file ini.
 * Kalau nama tab (sheet) di Google Sheets kamu berbeda dari
 * default di bawah, cukup ubah di sini — tidak perlu sentuh
 * file lain.
 * -------------------------------------------------------------
 */

const CONFIG = {
  // ID spreadsheet, diambil dari URL:
  // https://docs.google.com/spreadsheets/d/<ID_INI>/edit
  SPREADSHEET_ID: "1FAbcl_l4uxs7KlGFuKRABs_C5HM-qvAiOcPmF-4DqZk",

  // Judul yang tampil di dashboard
  TITLE: "Rekap Produksi",

  // Bulan & tahun yang sedang berjalan di file ini (untuk label & jumlah hari kalender)
  PERIOD_LABEL: "September 2026",
  DAYS_IN_MONTH: 30, // September = 30 hari. Ganti sesuai bulan berjalan.

  // Nama tab untuk tiap kategori rekap bulanan.
  // Ini harus SAMA PERSIS dengan nama tab di Google Sheets (huruf besar/kecil bebas).
  RECAP_SHEETS: {
    botol: "Rekap Botol",
    thermoCup: "Rekap Thermo Cup",
    thermoTray: "Rekap Thermo Tray & Lid",
    printing: "Rekap Printing",
    extruder: "Rekap Extruder",
  },

  // Sheet "Grand Total". Dibiarkan kosong ("") supaya dashboard otomatis
  // mengambil tab PERTAMA (paling kiri) di file — sesuai struktur bawaan
  // file ini ("REKAP GRAND TOTAL PRODUKSI"). Kalau ternyata salah ambil,
  // isi nama tab yang benar di sini, misalnya "Grand Total".
  GRAND_TOTAL_SHEET: "",

  // Nama tab harian mengikuti angka tanggal: "1", "2", ... "31"
  DAILY_SHEET_PREFIX: "",
  DAILY_SHEET_SUFFIX: "",

  // Definisi 6 panel yang muncul di tiap sheet harian (1-31), dipakai untuk
  // mencocokkan judul section saat membaca data. Urutan tidak berpengaruh.
  DAILY_SECTIONS: [
    { key: "botol", match: ["hasil prod botol"], label: "Botol", unit: "" },
    { key: "thermoCup", match: ["thermo (cup)", "thermo cup"], label: "Thermo Cup", unit: "" },
    { key: "thermoTray", match: ["thermo (tray)", "thermo tray"], label: "Thermo Tray & Lid", unit: "" },
    { key: "printing", match: ["hasil prod printing"], label: "Printing", unit: "" },
    { key: "extruderCS", match: ["extruder cs", "(e1)"], label: "Extruder CS (E1)", unit: "" },
    { key: "extruderDiamat", match: ["extruder diamat", "(e2)"], label: "Extruder Diamat (E2)", unit: "" },
  ],

  // Warna aksen tiap kategori (dipakai di kartu & grafik)
  CATEGORY_COLORS: {
    botol: "#F2A93B",
    thermoCup: "#4FD1A5",
    thermoTray: "#5AA9E6",
    printing: "#C77DFF",
    extruder: "#E85D5D",
    extruderCS: "#E85D5D",
    extruderDiamat: "#F27059",
  },

  // Refresh otomatis (milidetik). Set 0 untuk mematikan.
  AUTO_REFRESH_MS: 5 * 60 * 1000,
};
