const logEl = () => document.getElementById("log");
function log(...args){
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  logEl().textContent = `[${new Date().toLocaleTimeString()}] ${line}\n` + logEl().textContent;
}
function qs(id){ return document.getElementById(id); }

function toIsoFromDatetimeLocal(v){
  if (!v) return "";
  const d = new Date(v);
  return d.toISOString();
}
function setPill(running){
  const pill = qs("pillCollector");
  pill.textContent = `Collector: ${running ? "RUNNING" : "stopped"}`;
  pill.style.color = running ? "#35d07f" : "#9aa6d1";
  pill.style.borderColor = running ? "rgba(53,208,127,.6)" : "rgba(37,48,86,1)";
}

let selectedSlug = "";
let marketsCache = [];
let snapshotsCache = [];

let marketsSortState = { col: "updated_at", dir: "desc" }; // API-side defaults
let snapSortState = { col: "ts", dir: "desc" };            // client-side

async function apiGet(path){
  const r = await fetch(path);
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`Non-JSON from ${path}: ${text.slice(0,120)}`); }
}
async function apiPost(path, body){
  const r = await fetch(path, {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body || {})
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  try { return JSON.parse(text); }
  catch { return { ok:true, raw:text }; }
}

function parseSlugs(text){
  return text
    .split(/[\n,]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function fmtTs(ts){
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}

function setSelectedUI(slug){
  selectedSlug = slug;
  const m = marketsCache.find(x => x.slug === slug);
  qs("selSlug").textContent = slug || "—";
  qs("selTitle").textContent = m?.title || "—";
}

/* =========================
   SLUG LIBRARY (localStorage)
========================= */
const LIB_KEY = "pm_slug_library_v1";

function loadLib(){
  try {
    const raw = localStorage.getItem(LIB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveLib(arr){
  localStorage.setItem(LIB_KEY, JSON.stringify(arr));
}
function renderLib(){
  const tags = qs("libTags");
  if (!tags) return;
  const arr = loadLib();
  tags.innerHTML = "";
  arr.forEach(slug => {
    const t = document.createElement("div");
    t.className = "tag";
    t.textContent = slug;
    t.title = "Click to add to collector box";
    t.addEventListener("click", () => {
      const box = qs("collectorSlugs");
      const current = parseSlugs(box.value);
      if (!current.includes(slug)) current.push(slug);
      box.value = current.join("\n");
      log("Added slug to collector box:", slug);
    });

    // right-click remove
    t.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const next = loadLib().filter(x => x !== slug);
      saveLib(next);
      renderLib();
      log("Removed from library:", slug);
    });

    tags.appendChild(t);
  });
}

/* =========================
   TABLE SORTING (client-side)
========================= */
function compare(a, b, dir){
  const d = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * d;
  if (b == null) return -1 * d;

  // numeric
  const na = Number(a), nb = Number(b);
  const bothNum = Number.isFinite(na) && Number.isFinite(nb);

  if (bothNum) return (na - nb) * d;

  // date-ish
  const ta = Date.parse(a), tb = Date.parse(b);
  const bothDate = Number.isFinite(ta) && Number.isFinite(tb);
  if (bothDate) return (ta - tb) * d;

  return String(a).localeCompare(String(b)) * d;
}

function markSortableHeaders(){
  // Snapshots table headers: make sortable
  const snapThs = qs("snapTable").querySelectorAll("thead th");
  snapThs.forEach((th) => {
    const col = th.textContent.trim();
    th.classList.add("sortable");
    th.dataset.col = col;
    th.innerHTML = `${col}<span class="sort-ind"></span>`;
    th.addEventListener("click", () => {
      if (snapSortState.col === col) {
        snapSortState.dir = snapSortState.dir === "asc" ? "desc" : "asc";
      } else {
        snapSortState.col = col;
        snapSortState.dir = "desc";
      }
      renderSnapshots(snapshotsCache);
    });
  });
}

function updateSortIndicators(){
  // snapshots
  const snapThs = qs("snapTable").querySelectorAll("thead th");
  snapThs.forEach(th => {
    const ind = th.querySelector(".sort-ind");
    const col = th.dataset.col;
    if (!ind) return;
    if (col === snapSortState.col) ind.textContent = snapSortState.dir === "asc" ? " ↑" : " ↓";
    else ind.textContent = "";
  });
}

/* =========================
   RENDER: Markets + Snapshots
========================= */
function renderMarkets(rows){
  const tbody = qs("marketsTable").querySelector("tbody");
  tbody.innerHTML = "";

  rows.forEach(row => {
    const tr = document.createElement("tr");
    if (row.slug === selectedSlug) tr.classList.add("active");

    tr.innerHTML = `
      <td class="mono">${row.slug}</td>
      <td title="${(row.title||"").replaceAll('"','&quot;')}">${row.title || ""}</td>
      <td>${row.market_type || ""}</td>
      <td>${row.start_time ? fmtTs(row.start_time) : ""}</td>
      <td>${row.end_time ? fmtTs(row.end_time) : ""}</td>
      <td>${row.updated_at ? fmtTs(row.updated_at) : ""}</td>
    `;

    tr.addEventListener("click", () => selectMarket(row.slug));
    tbody.appendChild(tr);
  });

  qs("marketsMeta").textContent = `Markets shown: ${rows.length}`;
}

function sortedSnapshots(rows){
  const col = snapSortState.col;
  const dir = snapSortState.dir;

  const map = {
    ts: "ts",
    live: "live",
    ended: "ended",
    period: "period",
    elapsed: "elapsed",
    score: "score",
    best_bid: "best_bid",
    best_ask: "best_ask",
    last_trade: "last_trade",
    spread: "spread"
  };

  const key = map[col] || "ts";

  return [...rows].sort((a,b) => compare(a[key], b[key], dir));
}

function renderSnapshots(rows){
  snapshotsCache = Array.isArray(rows) ? rows : [];
  const sorted = sortedSnapshots(snapshotsCache);

  const tbody = qs("snapTable").querySelector("tbody");
  tbody.innerHTML = "";

  for (const r of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtTs(r.ts)}</td>
      <td>${r.live}</td>
      <td>${r.ended}</td>
      <td>${r.period || ""}</td>
      <td>${r.elapsed || ""}</td>
      <td>${r.score || ""}</td>
      <td>${r.best_bid ?? ""}</td>
      <td>${r.best_ask ?? ""}</td>
      <td>${r.last_trade ?? ""}</td>
      <td>${r.spread ?? ""}</td>
    `;
    tbody.appendChild(tr);
  }

  qs("snapMeta").textContent = `
  hown: ${sorted.length}`;
  updateSortIndicators();

  drawCharts(sorted);
}

/* =========================
   CHARTS (no libs)
========================= */
function drawLine(ctx, pts, pad=30){
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0,0,w,h);

  // background grid
  ctx.globalAlpha = 0.25;
  for (let i=1;i<6;i++){
    const y = (h * i)/6;
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(w,y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (!pts.length) return;

  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  const scaleX = (v) => pad + ((v - minX)/spanX) * (w - pad*2);
  const scaleY = (v) => (h - pad) - ((v - minY)/spanY) * (h - pad*2);

  ctx.beginPath();
  pts.forEach((p,i) => {
    const x = scaleX(p.x);
    const y = scaleY(p.y);
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // min/max labels
  ctx.font = "12px ui-sans-serif";
  ctx.fillText(`min: ${minY.toFixed(4)}`, 10, 16);
  ctx.fillText(`max: ${maxY.toFixed(4)}`, 10, 32);
}

function drawCharts(rows){
  const priceCanvas = qs("chartPrice");
  const spreadCanvas = qs("chartSpread");
  if (!priceCanvas || !spreadCanvas) return;

  // take last N by time ASC for chart
  const asc = [...rows].sort((a,b) => Date.parse(a.ts) - Date.parse(b.ts));
  const last = asc.slice(-300);

  const pricePts = last
    .filter(r => r.last_trade != null && r.ts)
    .map(r => ({ x: Date.parse(r.ts), y: Number(r.last_trade) }));

  const spreadPts = last
    .filter(r => r.spread != null && r.ts)
    .map(r => ({ x: Date.parse(r.ts), y: Number(r.spread) }));

  const c1 = priceCanvas.getContext("2d");
  const c2 = spreadCanvas.getContext("2d");

  // stroke defaults (no custom colors requested)
  c1.lineWidth = 2;
  c2.lineWidth = 2;

  drawLine(c1, pricePts);
  drawLine(c2, spreadPts);
}

/* =========================
   DATA LOADERS
========================= */
async function loadCollectorStatus(){
  try {
    const s = await apiGet("/api/collector/status");
    setPill(Boolean(s.running));
    qs("collectorMeta").textContent = `everySec=${s.everySec} • slugs=${(s.slugs||[]).length} • lastRun=${s.lastRun || "—"}`;
    qs("collectorErrors").textContent = (s.lastErrors||[]).slice(0,3).map(e => `• ${e.ts} ${e.slug}: ${e.error}`).join("\n");
  } catch(e){
    setPill(false);
    qs("collectorMeta").textContent = `Collector status error: ${e.message}`;
  }
}

async function loadMarkets(){
  const q = qs("marketsSearch").value.trim();
  const league = qs("marketsLeague").value.trim();
  const sort = qs("marketsSort").value;
  const dir = qs("marketsDir").value;
  const limit = Number(qs("marketsLimit").value || 200);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (league) params.set("league", league);
  params.set("sort", sort);
  params.set("dir", dir);
  params.set("limit", String(limit));

  const data = await apiGet(`/api/db/markets?${params.toString()}`);
  marketsCache = data.rows || [];
  renderMarkets(marketsCache);

  if (!selectedSlug && marketsCache.length) {
    await selectMarket(marketsCache[0].slug);
  } else {
    renderMarkets(marketsCache);
  }
}

function applyQuickRange(){
  const mode = qs("quickRange").value;
  const now = new Date();
  let from = "";
  let to = "";

  if (mode === "24h") {
    from = new Date(now.getTime() - 24*3600*1000).toISOString();
    to = now.toISOString();
  } else if (mode === "7d") {
    from = new Date(now.getTime() - 7*24*3600*1000).toISOString();
    to = now.toISOString();
  } else if (mode === "30d") {
    from = new Date(now.getTime() - 30*24*3600*1000).toISOString();
    to = now.toISOString();
  } else if (mode === "live") {
    from = "";
    to = "";
  } else {
    return;
  }

  qs("snapFrom").value = from ? from.slice(0,16) : "";
  qs("snapTo").value = to ? to.slice(0,16) : "";
}

async function loadSnapshots(){
  if (!selectedSlug) return;

  const limit = Number(qs("snapLimit").value || 500);
  const fromIso = toIsoFromDatetimeLocal(qs("snapFrom").value);
  const toIso = toIsoFromDatetimeLocal(qs("snapTo").value);

  const params = new URLSearchParams();
  params.set("slug", selectedSlug);
  params.set("limit", String(limit));
  if (fromIso) params.set("from", fromIso);
  if (toIso) params.set("to", toIso);

  const data = await apiGet(`/api/db/snapshots?${params.toString()}`);
  renderSnapshots(data.rows || []);
}

async function selectMarket(slug){
  setSelectedUI(slug);
  renderMarkets(marketsCache);
  await loadSnapshots();
}

/* =========================
   EXPORT
========================= */
function exportSnapshotsCsv(){
  const rows = Array.from(qs("snapTable").querySelectorAll("tbody tr")).map(tr =>
    Array.from(tr.querySelectorAll("td")).map(td => td.textContent)
  );
  const header = Array.from(qs("snapTable").querySelectorAll("thead th")).map(th => th.textContent.replace(" ↑","").replace(" ↓",""));

  const csv = [
    header,
    ...rows
  ].map(line => line.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${selectedSlug || "snapshots"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   COLLECTOR actions
========================= */
async function collectorStart(){
  const slugs = parseSlugs(qs("collectorSlugs").value);
  const everySec = Number(qs("collectorEverySec").value || 10);
  const res = await apiPost("/api/collector/start", { slugs, everySec });
  log("collector start:", res);
  await loadCollectorStatus();
}
async function collectorStop(){
  const res = await apiPost("/api/collector/stop", {});
  log("collector stop:", res);
  await loadCollectorStatus();
}
async function addSelectedToCollector(){
  if (!selectedSlug) return;
  const res = await apiPost("/api/collector/slugs/add", { slugs: [selectedSlug] });
  log("collector add:", res);
  await loadCollectorStatus();
}
async function removeSelectedFromCollector(){
  if (!selectedSlug) return;
  const res = await apiPost("/api/collector/slugs/remove", { slugs: [selectedSlug] });
  log("collector remove:", res);
  await loadCollectorStatus();
}

async function refreshAll(){
  try {
    await loadCollectorStatus();
    await loadMarkets();
    if (selectedSlug) await loadSnapshots();
    log("refresh ok");
  } catch(e){
    log("refresh error:", e.message);
  }
}

/* =========================
   WIRE UI
========================= */
function wireEvents(){
  qs("btnRefresh").addEventListener("click", refreshAll);

  qs("btnCollectorStart").addEventListener("click", async () => {
    try { await collectorStart(); } catch(e){ log("collectorStart error:", e.message); }
  });

  qs("btnCollectorStop").addEventListener("click", async () => {
    try { await collectorStop(); } catch(e){ log("collectorStop error:", e.message); }
  });

  qs("btnAddSelectedToCollector").addEventListener("click", async () => {
    try { await addSelectedToCollector(); } catch(e){ log("addSelected error:", e.message); }
  });

  qs("btnRemoveSelectedFromCollector").addEventListener("click", async () => {
    try { await removeSelectedFromCollector(); } catch(e){ log("removeSelected error:", e.message); }
  });

  qs("btnLoadSnapshots").addEventListener("click", async () => {
    try { await loadSnapshots(); } catch(e){ log("loadSnapshots error:", e.message); }
  });

  qs("btnExportCsv").addEventListener("click", exportSnapshotsCsv);

  qs("quickRange").addEventListener("change", () => applyQuickRange());

  ["marketsSearch","marketsLeague","marketsSort","marketsDir","marketsLimit"].forEach(id => {
    qs(id).addEventListener("change", () => loadMarkets().catch(e => log("loadMarkets error:", e.message)));
    qs(id).addEventListener("keyup", (ev) => {
      if (id === "marketsSearch" && ev.key === "Enter") loadMarkets().catch(e => log("loadMarkets error:", e.message));
    });
  });

  // library
  const btnLibSave = qs("btnLibSave");
  if (btnLibSave) {
    btnLibSave.addEventListener("click", () => {
      const slug = (qs("libSlug").value || "").trim();
      if (!slug) return;
      const arr = loadLib();
      if (!arr.includes(slug)) arr.unshift(slug);
      saveLib(arr.slice(0, 50));
      qs("libSlug").value = "";
      renderLib();
      log("Saved slug to library:", slug);
    });
  }
}

/* =========================
   BOOT
========================= */
(async function boot(){
  wireEvents();
  renderLib();
  applyQuickRange();
  markSortableHeaders();
  await refreshAll();

  setInterval(() => {
    loadCollectorStatus().catch(()=>{});
  }, 5000);
})();



