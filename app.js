/**
 * app.js — routing, data orchestration & rendering.
 */
const App = (() => {
  const state = {
    route: "overview",
    grandTotal: null, // { headers, rows, total }
    recap: {}, // { botol: {...}, thermoCup: {...}, ... }
    dailyCache: {}, // { "18": { botol: {...}, ... } }
    lastUpdated: null,
    loadError: null,
    charts: {}, // active Chart.js instances, keyed by canvas id, so we can destroy before re-render
  };

  const CATS = [
    { key: "botol", label: "Rekap Botol", route: "cat-botol" },
    { key: "thermoCup", label: "Rekap Thermo Cup", route: "cat-thermoCup" },
    { key: "thermoTray", label: "Rekap Thermo Tray & Lid", route: "cat-thermoTray" },
    { key: "printing", label: "Rekap Printing", route: "cat-printing" },
    { key: "extruder", label: "Rekap Extruder", route: "cat-extruder" },
  ];

  // ---------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------
  function fmt(n, decimals = 0) {
    if (typeof n !== "number" || Number.isNaN(n)) return "–";
    return n.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // ---------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------
  async function loadAll() {
    setStatus("loading", "Mengambil data…");
    state.loadError = null;
    try {
      const [grandMatrix, ...recapMatrices] = await Promise.all([
        GViz.fetchMatrix(CONFIG.GRAND_TOTAL_SHEET || undefined),
        ...CATS.map((c) => GViz.fetchMatrix(CONFIG.RECAP_SHEETS[c.key])),
      ]);
      state.grandTotal = GViz.parseTabularSheet(grandMatrix);
      CATS.forEach((c, i) => {
        state.recap[c.key] = GViz.parseTabularSheet(recapMatrices[i]);
      });
      state.lastUpdated = new Date();
      setStatus("ok", `Update terakhir ${state.lastUpdated.toLocaleTimeString("id-ID")}`);
    } catch (err) {
      console.error(err);
      state.loadError = err.message || String(err);
      setStatus("error", "Gagal memuat data");
    }
    render();
  }

  async function loadDay(day) {
    if (state.dailyCache[day]) return state.dailyCache[day];
    const matrix = await GViz.fetchMatrix(String(day));
    const parsed = GViz.parseDailySheet(matrix);
    state.dailyCache[day] = parsed;
    return parsed;
  }

  function setStatus(kind, text) {
    const dot = document.getElementById("statusDot");
    const label = document.getElementById("statusText");
    dot.className = "status-dot" + (kind === "error" ? " error" : kind === "loading" ? " loading" : "");
    label.textContent = text;
  }

  // ---------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------
  function primaryMetricKey(headers) {
    if (!headers || !headers.length) return null;
    // prefer a header mentioning "Pcs", else first header
    const pcs = headers.find((h) => /pcs/i.test(h));
    return pcs || headers[0];
  }

  function categoryTotalDisplay(key) {
    const recap = state.recap[key];
    if (!recap || !recap.headers.length) return { primary: null, primaryLabel: "", rest: [] };
    const primaryLabel = primaryMetricKey(recap.headers);
    const totals = recap.total || sumRows(recap);
    const primary = totals ? totals[primaryLabel] : null;
    const rest = recap.headers.filter((h) => h !== primaryLabel).slice(0, 3);
    return { primary, primaryLabel, rest, totals };
  }

  function sumRows(recap) {
    if (!recap.rows.length) return null;
    const out = {};
    recap.headers.forEach((h) => {
      out[h] = recap.rows.reduce((s, r) => s + (typeof r.values[h] === "number" ? r.values[h] : 0), 0);
    });
    return out;
  }

  function latestActiveDay(rows) {
    let last = null;
    for (const r of rows) {
      const hasValue = Object.values(r.values).some((v) => typeof v === "number" && v > 0);
      if (hasValue) last = r;
    }
    return last;
  }

  // ---------------------------------------------------------------
  // Rendering: shell
  // ---------------------------------------------------------------
  function render() {
    document.getElementById("periodLabel").textContent = CONFIG.PERIOD_LABEL;
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === state.route);
    });

    const titles = {
      overview: ["Overview", "Ringkasan seluruh kategori produksi bulan ini"],
      calendar: ["Kalender Harian", `Klik tanggal untuk lihat rincian produksi hari itu — ${CONFIG.PERIOD_LABEL}`],
    };
    CATS.forEach((c) => {
      titles[c.route] = [c.label, `Rekap harian & bulanan — ${CONFIG.PERIOD_LABEL}`];
    });
    const [title, subtitle] = titles[state.route] || ["Overview", ""];
    document.getElementById("pageTitle").textContent = title;
    document.getElementById("pageSubtitle").textContent = subtitle;

    const view = document.getElementById("view");
    Object.values(state.charts).forEach((c) => c && c.destroy());
    state.charts = {};

    if (state.loadError) {
      view.innerHTML = `<div class="error-box">⚠ ${escapeHtml(state.loadError)}<br/>
        Pastikan spreadsheet di-share sebagai <b>“Anyone with the link – Viewer”</b>, dan nama tab di <code>config.js</code> sudah sesuai.</div>`;
      return;
    }
    if (!state.grandTotal) {
      view.innerHTML = renderSkeleton();
      return;
    }

    if (state.route === "overview") view.innerHTML = renderOverview();
    else if (state.route === "calendar") view.innerHTML = renderCalendar();
    else if (state.route.startsWith("cat-")) view.innerHTML = renderCategory(state.route.slice(4));

    afterRenderCharts();
  }

  function renderSkeleton() {
    return `<div class="grid cols-6">${Array(6).fill('<div class="card"><div class="skeleton" style="height:70px"></div></div>').join("")}</div>`;
  }

  // ---------------------------------------------------------------
  // Rendering: overview
  // ---------------------------------------------------------------
  function renderOverview() {
    const gt = state.grandTotal;
    const gtTotals = gt.total || sumRows(gt);
    const latest = latestActiveDay(gt.rows);

    const kpiCards = CATS.map((c) => {
      const d = categoryTotalDisplay(c.key);
      const color = CONFIG.CATEGORY_COLORS[c.key] || "#F2A93B";
      return `
        <div class="card kpi-card" style="--kpi-color:${color}" data-route="${c.route}">
          <div class="kpi-label"><span>${c.label}</span></div>
          <div class="kpi-value">${d.primary != null ? fmt(d.primary) : "–"}<span class="kpi-unit">${d.primaryLabel || ""}</span></div>
          <div class="kpi-sub">
            ${d.rest.map((h) => `<span>${h}: <b>${d.totals ? fmt(d.totals[h]) : "–"}</b></span>`).join("")}
          </div>
        </div>`;
    }).join("");

    const gtStrip = gt.headers
      .map(
        (h) => `<div class="card tight">
          <div class="kpi-label">${h}</div>
          <div class="kpi-value" style="font-size:17px">${gtTotals ? fmt(gtTotals[h]) : "–"}</div>
        </div>`
      )
      .join("");

    return `
      <div class="section-title">Kategori Produksi <span class="hint">klik kartu untuk detail</span></div>
      <div class="grid cols-3">${kpiCards}</div>

      <div class="section-title">Grand Total Bulan Ini
        <span class="hint">${latest ? `hari terakhir terisi: tgl ${latest.day}` : ""}</span>
      </div>
      <div class="grid cols-4">${gtStrip}</div>

      <div class="section-title">Tren Harian — ${primaryMetricKey(gt.headers) || ""}</div>
      <div class="card"><div class="chart-box"><canvas id="trendChart"></canvas></div></div>
    `;
  }

  function afterRenderCharts() {
    document.querySelectorAll("[data-route]").forEach((el) => {
      el.addEventListener("click", () => setRoute(el.dataset.route));
    });

    const trendCanvas = document.getElementById("trendChart");
    if (trendCanvas && state.grandTotal) {
      const gt = state.grandTotal;
      const metric = primaryMetricKey(gt.headers);
      state.charts.trend = new Chart(trendCanvas, {
        type: "line",
        data: {
          labels: gt.rows.map((r) => r.day),
          datasets: [
            {
              label: metric,
              data: gt.rows.map((r) => r.values[metric]),
              borderColor: "#f2a93b",
              backgroundColor: "rgba(242,169,59,0.12)",
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: chartOptions(),
      });
    }

    const catCanvas = document.getElementById("catChart");
    if (catCanvas && state.route.startsWith("cat-")) {
      const key = state.route.slice(4);
      const recap = state.recap[key];
      const metric = primaryMetricKey(recap.headers);
      state.charts.cat = new Chart(catCanvas, {
        type: "bar",
        data: {
          labels: recap.rows.map((r) => r.day),
          datasets: [
            {
              label: metric,
              data: recap.rows.map((r) => r.values[metric]),
              backgroundColor: CONFIG.CATEGORY_COLORS[key] || "#f2a93b",
              borderRadius: 3,
            },
          ],
        },
        options: chartOptions(),
      });
    }
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#2d333d" }, ticks: { color: "#8a93a3", font: { family: "IBM Plex Mono", size: 10 } } },
        y: { grid: { color: "#2d333d" }, ticks: { color: "#8a93a3", font: { family: "IBM Plex Mono", size: 10 } } },
      },
    };
  }

  // ---------------------------------------------------------------
  // Rendering: calendar
  // ---------------------------------------------------------------
  function renderCalendar() {
    const gt = state.grandTotal;
    const metric = primaryMetricKey(gt.headers);
    const maxVal = Math.max(1, ...gt.rows.map((r) => r.values[metric] || 0));
    const byDay = {};
    gt.rows.forEach((r) => (byDay[r.day] = r));

    const cells = [];
    for (let d = 1; d <= CONFIG.DAYS_IN_MONTH; d++) {
      const row = byDay[d];
      const val = row ? row.values[metric] || 0 : 0;
      const hasData = val > 0;
      const pct = Math.round((val / maxVal) * 100);
      cells.push(`
        <div class="cal-cell ${hasData ? "" : "no-data"}" data-day="${d}">
          <div class="cal-day">${d}</div>
          <div class="cal-bar"><div class="cal-bar-fill" style="width:${hasData ? pct : 0}%"></div></div>
        </div>`);
    }

    return `
      <div class="section-title">Kalender Produksi <span class="hint">tinggi bar = ${metric}</span></div>
      <div class="calendar-grid">${cells.join("")}</div>
    `;
  }

  async function openDayModal(day) {
    const root = document.getElementById("modalRoot");
    root.innerHTML = `<div class="modal-overlay"><div class="modal"><div class="modal-head"><h2>Tanggal ${day} — ${CONFIG.PERIOD_LABEL}</h2><button class="modal-close">&times;</button></div><div class="empty-state">Memuat data harian…</div></div></div>`;
    root.querySelector(".modal-close").onclick = () => (root.innerHTML = "");
    root.querySelector(".modal-overlay").addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) root.innerHTML = "";
    });

    try {
      const data = await loadDay(day);
      const keys = Object.keys(data);
      const body = root.querySelector(".modal");
      if (!keys.length) {
        body.querySelector(".empty-state").textContent = "Tidak ada data terbaca untuk tanggal ini (sheet mungkin kosong atau formatnya berbeda).";
        return;
      }
      const panels = CONFIG.DAILY_SECTIONS.map((s) => data[s.key])
        .filter(Boolean)
        .map(
          (sec) => `
        <div class="mini-panel">
          <h4>${escapeHtml(sec.label)}</h4>
          <div class="sub-label">Harian</div>
          ${sec.harian.map((r) => `<div class="mini-row"><span>${escapeHtml(r.label)}</span><b>${fmt(r.value)}</b></div>`).join("") || '<div class="mini-row"><span>–</span></div>'}
          <div class="sub-label">Akumulasi</div>
          ${sec.akumulasi.map((r) => `<div class="mini-row"><span>${escapeHtml(r.label)}</span><b>${fmt(r.value)}</b></div>`).join("") || '<div class="mini-row"><span>–</span></div>'}
        </div>`
        )
        .join("");
      body.querySelector(".empty-state")?.remove();
      const wrap = document.createElement("div");
      wrap.className = "panel-grid";
      wrap.innerHTML = panels;
      body.appendChild(wrap);
    } catch (err) {
      root.querySelector(".empty-state").textContent = "Gagal memuat: " + err.message;
    }
  }

  // ---------------------------------------------------------------
  // Rendering: category page
  // ---------------------------------------------------------------
  function renderCategory(key) {
    const recap = state.recap[key];
    if (!recap || !recap.headers.length) {
      return `<div class="empty-state">Belum ada data terbaca dari sheet ini. Cek nama tab di <code>config.js</code>.</div>`;
    }
    const metric = primaryMetricKey(recap.headers);
    const rowsHtml = recap.rows
      .map(
        (r) => `<tr><td>${r.day}</td>${recap.headers.map((h) => `<td>${fmt(r.values[h])}</td>`).join("")}</tr>`
      )
      .join("");
    const totalRow = recap.total
      ? `<tr class="total-row"><td>TOTAL</td>${recap.headers.map((h) => `<td>${fmt(recap.total[h])}</td>`).join("")}</tr>`
      : "";

    return `
      <div class="section-title">Tren — ${metric}</div>
      <div class="card"><div class="chart-box"><canvas id="catChart"></canvas></div></div>

      <div class="section-title">Rincian Harian</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tgl</th>${recap.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}${totalRow}</tbody>
        </table>
      </div>
    `;
  }

  // ---------------------------------------------------------------
  // Router / events
  // ---------------------------------------------------------------
  function setRoute(route) {
    state.route = route;
    render();
    document.getElementById("sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindEvents() {
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.addEventListener("click", () => setRoute(el.dataset.route));
    });
    document.getElementById("refreshBtn").addEventListener("click", loadAll);
    document.getElementById("navToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
    document.getElementById("view").addEventListener("click", (e) => {
      const cell = e.target.closest(".cal-cell");
      if (cell && !cell.classList.contains("no-data")) openDayModal(cell.dataset.day);
    });
    if (CONFIG.AUTO_REFRESH_MS > 0) {
      setInterval(loadAll, CONFIG.AUTO_REFRESH_MS);
    }
  }

  function init() {
    bindEvents();
    loadAll();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
