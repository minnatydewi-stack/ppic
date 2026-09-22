/**
 * gviz.js
 * -------------------------------------------------------------
 * Lapisan pengambilan & parsing data dari Google Sheets, lewat
 * endpoint publik "gviz/tq" (tidak perlu API key, cukup file-nya
 * di-share sebagai "Anyone with the link – Viewer").
 * -------------------------------------------------------------
 */

const GViz = (() => {
  function buildUrl(sheetName) {
    const base = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
    return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
  }

  async function fetchRawTable(sheetName) {
    const res = await fetch(buildUrl(sheetName), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Gagal mengambil sheet "${sheetName || "(default)"}" (HTTP ${res.status})`);
    }
    const text = await res.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error(
        `Respons tidak dikenali untuk sheet "${sheetName || "(default)"}". ` +
          `Pastikan spreadsheet sudah di-share sebagai "Anyone with the link – Viewer".`
      );
    }
    const json = JSON.parse(text.slice(start, end + 1));
    if (!json.table) throw new Error(`Sheet "${sheetName || "(default)"}" tidak ditemukan / kosong.`);
    return json.table;
  }

  // Ubah tabel gviz jadi matrix 2D nilai mentah (angka tetap angka, teks tetap teks)
  function tableToMatrix(table) {
    const nCols = (table.cols || []).length;
    return (table.rows || []).map((row) => {
      const cells = row.c || [];
      const out = new Array(nCols).fill("");
      for (let i = 0; i < nCols; i++) {
        const cell = cells[i];
        if (!cell) continue;
        if (typeof cell.v === "number") out[i] = cell.v;
        else if (cell.v !== null && cell.v !== undefined) out[i] = String(cell.v).trim();
        else if (cell.f) out[i] = cell.f.trim();
      }
      return out;
    });
  }

  async function fetchMatrix(sheetName) {
    const table = await fetchRawTable(sheetName);
    return tableToMatrix(table);
  }

  function isNumericCell(v) {
    return typeof v === "number" && !Number.isNaN(v);
  }

  function isBlankRow(row) {
    return row.every((v) => v === "" || v === null || v === undefined);
  }

  // ---------------------------------------------------------------
  // Parser untuk sheet REKAP (Rekap Botol, Rekap Thermo Cup, dst) &
  // sheet Grand Total: format tabel dengan header berisi "Hari"/"Tanggal"
  // lalu 1..31 baris data, ditutup baris "TOTAL".
  // ---------------------------------------------------------------
  function parseTabularSheet(matrix) {
    let headerRowIdx = -1;
    for (let r = 0; r < matrix.length; r++) {
      const c0 = String(matrix[r][0] || "").toLowerCase();
      if (c0.includes("hari") || c0.includes("tanggal")) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) return { headers: [], rows: [], total: null };

    const rawHeaders = matrix[headerRowIdx];
    const lastColIdx = rawHeaders.reduce((last, v, i) => (v !== "" ? i : last), 0);
    const headers = rawHeaders.slice(1, lastColIdx + 1).map((h, i) => String(h || `Kolom ${i + 1}`).trim());

    const rows = [];
    let total = null;

    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (isBlankRow(row)) continue;
      const label = String(row[0] || "").trim();
      if (/^total/i.test(label)) {
        total = {};
        headers.forEach((h, i) => (total[h] = row[i + 1]));
        break; // berhenti setelah baris TOTAL
      }
      const dayNum = Number(label);
      if (!Number.isFinite(dayNum)) continue;
      const values = {};
      headers.forEach((h, i) => (values[h] = row[i + 1]));
      rows.push({ day: dayNum, values });
    }

    return { headers, rows, total };
  }

  // ---------------------------------------------------------------
  // Parser untuk sheet HARIAN (tab "1".."31"): 6 panel section dengan
  // judul seperti "Hasil Prod Botol Harian", masing-masing berisi baris
  // "Harian" lalu sub-header "Akumulasi" lalu baris kumulatif.
  // ---------------------------------------------------------------
  function findHeaderCells(matrix) {
    const found = [];
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        const v = matrix[r][c];
        if (typeof v !== "string" || !v.trim()) continue;
        const low = v.toLowerCase();
        for (const section of CONFIG.DAILY_SECTIONS) {
          if (section.match.some((m) => low.includes(m))) {
            found.push({ row: r, col: c, key: section.key, label: section.label });
          }
        }
      }
    }
    return found;
  }

  function parseDailySheet(matrix) {
    const headers = findHeaderCells(matrix);
    if (headers.length === 0) return {};

    // Kelompokkan header jadi "band" berdasarkan baris (toleransi 1 baris)
    const sortedByRow = [...headers].sort((a, b) => a.row - b.row);
    const bands = [];
    for (const h of sortedByRow) {
      let band = bands.find((b) => Math.abs(b.row - h.row) <= 1);
      if (!band) {
        band = { row: h.row, items: [] };
        bands.push(band);
      }
      band.items.push(h);
    }
    bands.forEach((b) => b.items.sort((a, b2) => a.col - b2.col));
    bands.sort((a, b) => a.row - b.row);

    const result = {};

    bands.forEach((band, bandIdx) => {
      const nextBandRow = bands[bandIdx + 1] ? bands[bandIdx + 1].row : matrix.length;
      band.items.forEach((h, itemIdx) => {
        const nextColStart = band.items[itemIdx + 1] ? band.items[itemIdx + 1].col : matrix[h.row].length;
        const colStart = h.col;
        const colEnd = Math.max(colStart, nextColStart - 1);
        const rowStart = h.row + 1;
        const rowEnd = Math.min(nextBandRow - 1, matrix.length - 1);

        const harian = [];
        const akumulasi = [];
        let mode = "harian";
        let lastPrimaryLabel = "";

        for (let r = rowStart; r <= rowEnd; r++) {
          const row = matrix[r] || [];
          const slice = row.slice(colStart, colEnd + 1);
          if (slice.every((v) => v === "" || v === null)) continue;

          const textParts = slice.filter((v) => typeof v === "string" && v.trim() !== "");
          const joined = textParts.join(" ").trim();

          if (/akumulasi/i.test(joined)) {
            mode = "akumulasi";
            continue;
          }

          const numericVals = slice.filter((v) => isNumericCell(v));
          if (numericVals.length === 0) continue;
          const value = numericVals[numericVals.length - 1];

          let label = joined.replace(/akumulasi/i, "").trim();
          if (!label) label = lastPrimaryLabel;
          else if (label.split(" ").length <= 1 && /^(box|pcs|kg)$/i.test(label)) {
            label = lastPrimaryLabel ? `${lastPrimaryLabel} ${label}` : label;
          } else {
            lastPrimaryLabel = label.replace(/\b(box|pcs|kg)\b/i, "").trim() || label;
          }

          (mode === "harian" ? harian : akumulasi).push({ label: label || "Nilai", value });
        }

        result[h.key] = { label: h.label, harian, akumulasi };
      });
    });

    return result;
  }

  return {
    fetchMatrix,
    parseTabularSheet,
    parseDailySheet,
  };
})();
