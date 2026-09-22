/* ============================================================
   DASHBOARD REKAP PRODUKSI — script.js
   Ambil data langsung dari Google Sheets (CSV export), parse
   otomatis berdasarkan header kolom, lalu render:
   - KPI cards
   - Kalender 1-31 (heatmap per hari)
   - Grafik tren harian
   - Tabel data lengkap
   - Rekap bulanan (khusus tab Ringkasan)
   ============================================================ */

const state = {
  monthKey: CONFIG.months[0].key,
  activeCategory: CONFIG.categories[0].id,
  cache: {}, // cache[monthKey][sheetKey] = parsed sheet data
  chart: null,
};

// ---------- Utils ----------

function parseIndoNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "" || s === "-") return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Mendeteksi baris header (mengandung "Tanggal"/"Hari"), lalu
 * mengambil semua baris data harian (1..31) dan baris TOTAL kalau ada.
 * Ini dibuat generik supaya tetap jalan walau jumlah/nama kolom
 * berbeda antar tab (Botol, Thermo Cup, Printing, dst).
 */
function analyzeSheet(rows) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => /tanggal|hari\s*\/\s*tanggal|^hari$/i.test((c || "").trim()))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('Baris header ("Tanggal"/"Hari") tidak ditemukan di sheet ini.');
  }

  const headerRow = rows[headerIdx];
  const cols = [];
  headerRow.forEach((label, idx) => {
    const clean = (label || "").trim();
    if (clean) cols.push({ idx, label: clean });
  });

  const dayCol = cols.find((c) => /tanggal|hari/i.test(c.label)) || cols[0];
  const valueCols = cols.filter((c) => c.idx !== dayCol.idx);

  const days = [];
  let totalRow = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => (c || "").trim() === "")) continue;

    const firstCell = (r[dayCol.idx] || "").trim();

    if (/total/i.test(firstCell)) {
      const values = {};
      valueCols.forEach((c) => (values[c.label] = parseIndoNumber(r[c.idx])));
      totalRow = values;
      break;
    }

    const dayNum = parseInt(firstCell, 10);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) continue;

    const values = {};
    valueCols.forEach((c) => (values[c.label] = parseIndoNumber(r[c.idx])));
    days.push({ day: dayNum, values });
  }

  // Kalau tidak ada baris TOTAL eksplisit, hitung sendiri dari data harian.
  if (!totalRow) {
    totalRow = {};
    valueCols.forEach((c) => {
      totalRow[c.label] = days.reduce((sum, d) => sum + (d.values[c.label] || 0), 0);
    });
  }

  return { valueCols: valueCols.map((c) => c.label), days, totalRow };
}

async function fetchSheetCSV(spreadsheetId, sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  const url = sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Gagal mengambil data (${res.status}). Pastikan spreadsheet dibagikan sebagai "Siapa saja yang memiliki link" dan nama tab "${sheetName || "(default)"}" sudah benar.`
    );
  }
  const text = await res.text();
  if (text.trim().startsWith("<")) {
    throw new Error(
      `Sheet "${sheetName || "(default)"}" tidak ditemukan atau spreadsheet belum dibagikan publik.`
    );
  }
  return text;
}

async function getSheetData(monthKey, category) {
  const month = CONFIG.months.find((m) => m.key === monthKey);
  const cacheKey = category.sheet || "__default__";
  state.cache[monthKey] = state.cache[monthKey] || {};
  if (state.cache[monthKey][cacheKey]) return state.cache[monthKey][cacheKey];

  const csv = await fetchSheetCSV(month.spreadsheetId, category.sheet);
  const rows = parseCSV(csv);
  const parsed = analyzeSheet(rows);
  state.cache[monthKey][cacheKey] = parsed;
  return parsed;
}

// ---------- Rendering ----------

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function renderNav() {
  const nav = document.getElementById("category-nav");
  nav.innerHTML = "";
  CONFIG.categories.forEach((cat) => {
    const btn = el(`
      <button data-id="${cat.id}"
        class="tab-btn ${cat.id === state.activeCategory ? "tab-btn-active" : ""}"
        style="--accent:${cat.color}">
        ${cat.label}
      </button>
    `);
    btn.addEventListener("click", () => {
      state.activeCategory = cat.id;
      renderNav();
      renderActiveView();
    });
    nav.appendChild(btn);
  });
}

function renderMonthSelect() {
  const sel = document.getElementById("month-select");
  sel.innerHTML = CONFIG.months
    .map((m) => `<option value="${m.key}">${m.label}</option>`)
    .join("");
  sel.value = state.monthKey;
  sel.addEventListener("change", () => {
    state.monthKey = sel.value;
    renderActiveView();
  });
}

function setStatus(msg, isError) {
  const box = document.getElementById("status-box");
  if (!msg) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }
  box.classList.remove("hidden");
  box.textContent = msg;
  box.classList.toggle("status-error", !!isError);
  box.classList.toggle("status-info", !isError);
}

function pickPrimaryMetric(valueCols) {
  const preferred = valueCols.find((v) => /box/i.test(v)) || valueCols.find((v) => /pcs/i.test(v));
  return preferred || valueCols[0];
}

function colorForValue(value, min, max) {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return "#eef2f7";
  }
  const ratio = max === min ? 1 : (value - min) / (max - min);
  const lightness = 88 - ratio * 55; // 88% (muda) -> 33% (tua)
  return `hsl(158, 60%, ${lightness}%)`;
}

function renderKPI(totalRow, valueCols) {
  const wrap = document.getElementById("kpi-cards");
  wrap.innerHTML = "";
  valueCols.slice(0, 4).forEach((label) => {
    wrap.appendChild(
      el(`
        <div class="kpi-card">
          <div class="kpi-label">${label}</div>
          <div class="kpi-value">${formatNumber(totalRow[label])}</div>
        </div>
      `)
    );
  });
}

function renderCalendar(days, valueCols, primaryMetric) {
  const wrap = document.getElementById("calendar-grid");
  const metricSelect = document.getElementById("metric-select");
  metricSelect.innerHTML = valueCols
    .map((v) => `<option value="${v}" ${v === primaryMetric ? "selected" : ""}>${v}</option>`)
    .join("");

  const draw = (metric) => {
    wrap.innerHTML = "";
    const values = days.map((d) => d.values[metric]).filter((v) => v !== null && v !== undefined);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const maxDay = Math.max(31, ...days.map((d) => d.day));

    for (let day = 1; day <= maxDay; day++) {
      const d = days.find((x) => x.day === day);
      const val = d ? d.values[metric] : null;
      const bg = colorForValue(val, min, max);
      const cell = el(`
        <button class="cal-cell" style="background:${bg}">
          <span class="cal-day">${day}</span>
          <span class="cal-val">${val === null || val === undefined ? "-" : formatNumber(val)}</span>
        </button>
      `);
      if (d) {
        cell.addEventListener("click", () => showDayDetail(d, valueCols));
      } else {
        cell.classList.add("cal-cell-empty");
      }
      wrap.appendChild(cell);
    }
  };

  draw(primaryMetric);
  metricSelect.onchange = () => draw(metricSelect.value);
}

function showDayDetail(dayData, valueCols) {
  const panel = document.getElementById("day-detail");
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="day-detail-title">Detail Tanggal ${dayData.day}</div>
    <div class="day-detail-grid">
      ${valueCols
        .map(
          (label) => `
        <div class="day-detail-item">
          <div class="day-detail-label">${label}</div>
          <div class="day-detail-value">${formatNumber(dayData.values[label])}</div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

function renderChart(days, valueCols, accentColor) {
  const ctx = document.getElementById("trend-chart").getContext("2d");
  const labels = days.map((d) => d.day);
  const palette = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

  const datasets = valueCols.map((label, i) => ({
    label,
    data: days.map((d) => d.values[label]),
    borderColor: valueCols.length === 1 ? accentColor : palette[i % palette.length],
    backgroundColor: "transparent",
    tension: 0.25,
    pointRadius: 2,
    borderWidth: 2,
  }));

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { title: { display: true, text: "Tanggal" } },
        y: { beginAtZero: true },
      },
      plugins: { legend: { position: "bottom" } },
    },
  });
}

function renderTable(days, valueCols, totalRow) {
  const wrap = document.getElementById("data-table");
  const head = `
    <tr>
      <th>Tanggal</th>
      ${valueCols.map((v) => `<th>${v}</th>`).join("")}
    </tr>`;
  const body = days
    .map(
      (d) => `
      <tr>
        <td>${d.day}</td>
        ${valueCols.map((v) => `<td>${formatNumber(d.values[v])}</td>`).join("")}
      </tr>`
    )
    .join("");
  const foot = `
    <tr class="table-total-row">
      <td>TOTAL</td>
      ${valueCols.map((v) => `<td>${formatNumber(totalRow[v])}</td>`).join("")}
    </tr>`;
  wrap.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`;
}

async function renderMonthlyRecap() {
  const wrap = document.getElementById("monthly-recap");
  wrap.innerHTML = `<div class="loading">Memuat rekap bulanan...</div>`;
  const others = CONFIG.categories.filter((c) => !c.isOverview);

  try {
    const results = await Promise.all(
      others.map(async (cat) => {
        try {
          const data = await getSheetData(state.monthKey, cat);
          return { cat, data, error: null };
        } catch (e) {
          return { cat, data: null, error: e.message };
        }
      })
    );

    wrap.innerHTML = "";
    results.forEach(({ cat, data, error }) => {
      if (error) {
        wrap.appendChild(
          el(`
          <div class="recap-card" style="--accent:${cat.color}">
            <div class="recap-card-title">${cat.label}</div>
            <div class="recap-card-error">Gagal memuat: ${error}</div>
          </div>`)
        );
        return;
      }
      const items = data.valueCols
        .map(
          (label) => `
        <div class="recap-item">
          <span>${label}</span>
          <strong>${formatNumber(data.totalRow[label])}</strong>
        </div>`
        )
        .join("");
      const card = el(`
        <div class="recap-card" style="--accent:${cat.color}">
          <div class="recap-card-title">${cat.label}</div>
          <div class="recap-card-body">${items}</div>
        </div>
      `);
      card.addEventListener("click", () => {
        state.activeCategory = cat.id;
        renderNav();
        renderActiveView();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      wrap.appendChild(card);
    });
  } catch (e) {
    wrap.innerHTML = `<div class="status-error">Gagal memuat rekap bulanan: ${e.message}</div>`;
  }
}

async function renderActiveView() {
  const category = CONFIG.categories.find((c) => c.id === state.activeCategory);
  const monthlyRecapSection = document.getElementById("monthly-recap-section");
  document.getElementById("view-title").textContent = category.label;
  document.getElementById("day-detail").classList.add("hidden");
  setStatus("Memuat data dari Google Sheets...", false);

  monthlyRecapSection.classList.toggle("hidden", !category.isOverview);

  try {
    const data = await getSheetData(state.monthKey, category);
    if (!data.valueCols.length) {
      setStatus("Sheet ditemukan tapi tidak ada kolom data yang terbaca.", true);
      return;
    }
    setStatus(null);

    renderKPI(data.totalRow, data.valueCols);
    const primary = pickPrimaryMetric(data.valueCols);
    renderCalendar(data.days, data.valueCols, primary);
    renderChart(data.days, data.valueCols, category.color);
    renderTable(data.days, data.valueCols, data.totalRow);

    if (category.isOverview) {
      renderMonthlyRecap();
    }

    document.getElementById("last-updated").textContent =
      "Terakhir dimuat: " + new Date().toLocaleString("id-ID");
  } catch (e) {
    setStatus(e.message, true);
    document.getElementById("kpi-cards").innerHTML = "";
    document.getElementById("calendar-grid").innerHTML = "";
    document.getElementById("data-table").innerHTML = "";
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
  }
}

function clearCacheAndReload() {
  state.cache = {};
  renderActiveView();
}

document.addEventListener("DOMContentLoaded", () => {
  renderMonthSelect();
  renderNav();
  document.getElementById("refresh-btn").addEventListener("click", clearCacheAndReload);
  renderActiveView();
});
