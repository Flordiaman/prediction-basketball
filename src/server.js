// E:\prediction_basketball\src\server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3001;

// NOTE: Main app DB from your db.js
const { db, init, DB_PATH } = require("../db.js");
init();

const polymarket = require("./polymarket");
const { openNbaDb } = require("./nbaDb");
const makeNbaRouter = require("./nbaRouter");
const { openPmDb } = require("./pmDb");

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   NBA SPEED BUILD ROUTES
   =============================== */

app.get("/api/status", (req, res) => {
  res.json({
    lastUpdatedUtc: new Date().toISOString(),
    datasets: {
      games: { lastUpdatedUtc: new Date().toISOString() },
      players: { lastUpdatedUtc: new Date().toISOString() },
      teams: { lastUpdatedUtc: new Date().toISOString() },
      picks: { lastUpdatedUtc: new Date().toISOString() },
    },
  });
});

app.get("/api/nba/games", (req, res) => {
  const date = req.query.date || null;
  res.json({ ok: true, date, items: [] });
});

app.get("/api/nba/players", (req, res) => {
  const search = req.query.search || "";
  res.json({ ok: true, search, items: [] });
});

app.get("/api/nba/teams", (req, res) => {
  res.json({ ok: true, items: [] });
});

app.get("/api/nba/picks", (req, res) => {
  const date = req.query.date || null;

  const mockPicks = [
    {
      id: "pick_001",
      date,
      market: "player_points_over",
      player: "Example Player",
      team: "EX",
      opponent: "OPP",
      line: 22.5,
      projected: 26.1,
      last10_avg: 24.8,
      last10_std: 4.2,
      sample_n: 10,
      notes: ["Usage trending up", "Opponent pace high"],
      updatedUtc: new Date().toISOString(),
    },
    {
      id: "pick_002",
      date,
      market: "player_rebounds_under",
      player: "Another Dude",
      team: "AA",
      opponent: "BB",
      line: 10.5,
      projected: 8.7,
      last10_avg: 9.9,
      last10_std: 3.8,
      sample_n: 10,
      notes: ["Minutes risk", "Role unstable"],
      updatedUtc: new Date().toISOString(),
    },
  ];

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  function scorePick(p) {
    const edge = p.projected - p.line;
    const absEdge = Math.abs(edge);
    const vol = typeof p.last10_std === "number" ? p.last10_std : 5.0;
    const snr = absEdge / (vol || 1);

    const confidence = Math.round(clamp((snr / 1.2) * 100, 0, 100));

    let tier = "PASS";
    if (confidence >= 70) tier = "STRONG";
    else if (confidence >= 50) tier = "EDGE";
    else if (confidence >= 35) tier = "LEAN";

    const side = edge >= 0 ? "OVER" : "UNDER";

    const warnings = [];
    if (vol >= 6) warnings.push("High volatility");
    if ((p.sample_n || 0) < 8) warnings.push("Small sample");
    if (confidence < 35) warnings.push("Weak edge");

    return {
      ...p,
      side,
      edge: Number(edge.toFixed(2)),
      absEdge: Number(absEdge.toFixed(2)),
      volatility: Number(vol.toFixed(2)),
      snr: Number(snr.toFixed(2)),
      confidence,
      tier,
      warnings,
    };
  }

  const items = mockPicks.map(scorePick).sort((a, b) => b.confidence - a.confidence);

  res.json({
    ok: true,
    date,
    model: "speedbuild_v0",
    rules: {
      freshnessDaysMax: 7,
      note: "Anything older than 7 days is OLD. Replace mockPicks with real model output.",
    },
    items,
  });
});

/* ===============================
   Serve /nba static site
   =============================== */

const nbaDirDist = path.join(__dirname, "..", "web", "dist");
const nbaDirLocal = path.join(__dirname, "..", "web", "nba");
const nbaDirOld = path.join(__dirname, "..", "web", "nba-old");

function pickNbaDir() {
  if (fs.existsSync(path.join(nbaDirDist, "index.html"))) return nbaDirDist;
  if (fs.existsSync(path.join(nbaDirLocal, "index.html"))) return nbaDirLocal;
  if (fs.existsSync(path.join(nbaDirOld, "index.html"))) return nbaDirOld;
  return null;
}

const nbaDir = pickNbaDir();

if (nbaDir) {
  app.use("/nba", express.static(nbaDir));

  app.get(["/nba", "/nba/"], (req, res) => {
    res.sendFile(path.join(nbaDir, "index.html"));
  });

  // SPA fallback under /nba (no extension)
  app.get(/^\/nba\/(?!.*\.[^/]+$).*/, (req, res) => {
    res.sendFile(path.join(nbaDir, "index.html"));
  });

  console.log("✅ Serving /nba from:", nbaDir);
} else {
  console.warn("⚠️ NBA not found: missing index.html in dist/nba, nba, and nba-old");
}

/* ===============================
   Utility helpers
   =============================== */

function canonicalPrice(raw) {
  const bid = raw?.bestBid != null ? Number(raw.bestBid) : null;
  const ask = raw?.bestAsk != null ? Number(raw.bestAsk) : null;
  const last = raw?.lastTradePrice != null ? Number(raw.lastTradePrice) : null;

  const hasBid = bid != null && !Number.isNaN(bid);
  const hasAsk = ask != null && !Number.isNaN(ask);

  if (hasBid && hasAsk) return (bid + ask) / 2;
  if (last != null && !Number.isNaN(last)) return last;
  if (hasBid) return bid;
  if (hasAsk) return ask;
  return null;
}

function bdlHeaders() {
  const key = (process.env.BALLDONTLIE_API_KEY || "").trim();
  if (!key) return {};
  return { Authorization: key, "X-API-Key": key };
}

function makeSeries(slug, points = 180) {
  let seed = 0;
  for (let i = 0; i < slug.length; i++) seed = (seed * 31 + slug.charCodeAt(i)) >>> 0;

  function rand() {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >> 17;
    seed >>>= 0;
    seed ^= seed << 5;
    seed >>>= 0;
    return (seed >>> 0) / 4294967296;
  }

  const now = Date.now();
  const stepMs = 60 * 1000;
  let v = 0.52 + rand() * 0.08;

  const series = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now - i * stepMs).toISOString();
    v += (rand() - 0.5) * 0.01 + 0.0005;
    v = Math.max(0.01, Math.min(0.99, v));
    series.push({ t, v: Number(v.toFixed(4)) });
  }
  return series;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWith429Retry(url, opts, { maxRetries = 8, baseDelayMs = 1500 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, opts);
    if (resp.status !== 429) return resp;

    const ra = resp.headers.get("retry-after");
    const retryAfterMs = ra ? Number(ra) * 1000 : null;

    const backoff =
      retryAfterMs != null && !Number.isNaN(retryAfterMs)
        ? retryAfterMs
        : baseDelayMs * Math.pow(2, attempt);

    await sleep(Math.min(backoff, 30000));
  }

  return fetch(url, opts);
}

/* ===============================
   NBA (isolated CSV → SQLite)
   =============================== */

const nbaOpened = openNbaDb();
const nbaDb = nbaOpened.db;

app.use("/api/nba/core", makeNbaRouter(nbaDb, { NBA_DB_PATH: nbaOpened.NBA_DB_PATH }));

try {
  const nbaHistory = require("../server/routes/nbahistory");
  app.use("/api/nba/history", nbaHistory);
} catch (e) {
  console.log("nbaHistory router not loaded:", e?.message || e);
}

/* ===============================
   PM DB (markets + snapshots)
   =============================== */

const pmDb = openPmDb();

/* ===============================
   Health + main DB debug
   =============================== */

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/db/ping", (req, res) => {
  try {
    const row = db.prepare("SELECT 1 AS ok").get();
    res.json({ ...row, db: DB_PATH });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* ===============================
   PM markets + snapshots
   =============================== */

app.post("/api/db/markets/save", (req, res) => {
  const m = req.body || {};
  const slug = String(m.slug || m.marketSlug || m.id || "").trim();
  const title = String(m.title || m.question || m.name || "").trim();
  const league = String(m.league || m.category || "").trim();

  if (!slug) return res.status(400).json({ error: "Missing slug/id in body" });

  pmDb
    .prepare(
      `
      INSERT INTO pm_markets (slug, league, title, active, updated_at)
      VALUES (@slug, @league, @title, 1, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        league=excluded.league,
        title=excluded.title,
        active=1,
        updated_at=datetime('now')
    `
    )
    .run({ slug, league, title });

  res.json({ ok: true, slug, title, league });
});

app.post("/api/db/markets", (req, res) => {
  const slug = String(req.body.slug || "").trim();
  const league = String(req.body.league || "").trim();
  const title = String(req.body.title || "").trim();

  if (!slug) return res.status(400).json({ error: "Missing slug" });

  pmDb
    .prepare(
      `
      INSERT INTO pm_markets (slug, league, title, active, updated_at)
      VALUES (@slug, @league, @title, 1, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        league=excluded.league,
        title=excluded.title,
        active=1,
        updated_at=datetime('now')
    `
    )
    .run({ slug, league, title });

  res.json({ ok: true, slug });
});

app.get("/api/db/snapshots", (req, res) => {
  const slug = String(req.query.slug || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 5000);

  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const rows = pmDb
    .prepare(
      `
      SELECT ts, price, best_bid, best_ask, volume
      FROM pm_snapshots
      WHERE slug = ?
      ORDER BY ts DESC
      LIMIT ?
    `
    )
    .all(slug, limit);

  res.json({ rows });
});

/* ===============================
   PM passthrough + collector
   =============================== */

app.get("/api/pm/market", async (req, res) => {
  try {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    if (!polymarket.getMarketBySlug) {
      return res.status(500).json({ error: "polymarket.getMarketBySlug not available" });
    }

    const m = await polymarket.getMarketBySlug(slug);
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/collector/collect-one", async (req, res) => {
  try {
    const slug = String(req.body.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const m = await polymarket.getMarketBySlug(slug);
    if (!m) return res.status(404).json({ error: "Market not found" });

    const r = m.raw ?? {};

    const price = canonicalPrice(r);
    const bestBid = r.bestBid != null ? Number(r.bestBid) : null;
    const bestAsk = r.bestAsk != null ? Number(r.bestAsk) : null;
    const volume = r.volume != null ? Number(r.volume) : null;

    const safe = (x) => (x == null || Number.isNaN(x) ? null : x);

    pmDb
      .prepare(
        `
        INSERT INTO pm_snapshots (
          slug, ts, price, best_bid, best_ask, volume, raw_json
        )
        VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
      `
      )
      .run(slug, safe(price), safe(bestBid), safe(bestAsk), safe(volume), JSON.stringify(m));

    res.json({ ok: true, slug, price: safe(price), ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// interval collector
let collectorState = {
  running: false,
  everySec: Number(process.env.PM_COLLECT_EVERY_SEC || 30),
  slugs: [],
  lastRun: null,
  lastErrors: [],
};

let collectorTimer = null;

async function collectAllOnce() {
  const slugs = pmDb
    .prepare("SELECT slug FROM pm_markets WHERE active=1 ORDER BY updated_at DESC")
    .all()
    .map((r) => r.slug);

  collectorState.slugs = slugs;
  collectorState.lastRun = new Date().toISOString();

  for (const slug of slugs) {
    try {
      const m = await polymarket.getMarketBySlug(slug);
      const r = m?.raw || {};

      const price = canonicalPrice(r);
      const bestBid = r.bestBid != null ? Number(r.bestBid) : null;
      const bestAsk = r.bestAsk != null ? Number(r.bestAsk) : null;
      const volume = r.volume != null ? Number(r.volume) : null;

      pmDb
        .prepare(
          `
          INSERT INTO pm_snapshots (slug, ts, price, best_bid, best_ask, volume, raw_json)
          VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
        `
        )
        .run(slug, price, bestBid, bestAsk, volume, JSON.stringify(m));
    } catch (e) {
      collectorState.lastErrors.unshift({
        ts: new Date().toISOString(),
        slug,
        error: String(e.message || e),
      });
      collectorState.lastErrors = collectorState.lastErrors.slice(0, 20);
    }
  }
}

app.get("/api/collector/status", (req, res) => {
  const slugs = pmDb
    .prepare("SELECT slug FROM pm_markets WHERE active=1 ORDER BY updated_at DESC")
    .all()
    .map((r) => r.slug);

  collectorState.slugs = slugs;
  res.json(collectorState);
});

app.post("/api/collector/start", async (req, res) => {
  collectorState.everySec = Math.max(5, Number(req.body.everySec || collectorState.everySec || 30));

  const slugs = Array.isArray(req.body.slugs)
    ? req.body.slugs.map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (slugs.length) {
    const upsert = pmDb.prepare(`
      INSERT INTO pm_markets (slug, league, title, active, updated_at)
      VALUES (@slug, @league, @title, 1, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        active=1,
        updated_at=datetime('now')
    `);

    const tx = pmDb.transaction((items) => {
      for (const slug of items) upsert.run({ slug, league: "NBA", title: "" });
    });

    tx(slugs);
  }

  if (collectorTimer) clearInterval(collectorTimer);
  collectorTimer = null;

  collectorState.running = true;

  await collectAllOnce();
  collectorTimer = setInterval(() => {
    collectAllOnce().catch(() => {});
  }, collectorState.everySec * 1000);

  res.json({ ok: true, running: true, everySec: collectorState.everySec });
});

app.post("/api/collector/stop", (req, res) => {
  if (collectorTimer) clearInterval(collectorTimer);
  collectorTimer = null;
  collectorState.running = false;
  res.json({ ok: true, running: false });
});

// optional auto-start
setTimeout(() => {
  if (collectorTimer) return;
  collectorState.running = true;
  collectAllOnce().catch(() => {});
  collectorTimer = setInterval(
    () => collectAllOnce().catch(() => {}),
    collectorState.everySec * 1000
  );
}, 3000);

/* ===============================
   Narrative helpers
   =============================== */

function computeTrend(series) {
  if (!series || series.length < 10) return { dir: "flat", delta: 0 };
  const first = series[0].v;
  const last = series[series.length - 1].v;
  const delta = last - first;
  const eps = 0.01;
  const dir = delta > eps ? "up" : delta < -eps ? "down" : "flat";
  return { dir, delta: Number(delta.toFixed(4)) };
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function computeVolatility(priceSeries) {
  if (!priceSeries || priceSeries.length < 3) return 0;
  const rets = [];
  for (let i = 1; i < priceSeries.length; i++) {
    const p0 = Number(priceSeries[i - 1].v);
    const p1 = Number(priceSeries[i].v);
    if (!isFinite(p0) || !isFinite(p1) || p0 <= 0) continue;
    rets.push(p1 / p0 - 1);
  }
  return stddev(rets);
}

function pctChange(priceSeries) {
  if (!priceSeries || priceSeries.length < 2) return 0;
  const first = Number(priceSeries[0].v);
  const last = Number(priceSeries[priceSeries.length - 1].v);
  if (!isFinite(first) || !isFinite(last) || first === 0) return 0;
  return (last - first) / first;
}

/* ===============================
   Narrative route
   =============================== */

app.get("/api/narrative/:slug", (req, res) => {
  try {
    const { slug } = req.params;

    const points = Math.min(Math.max(Number(req.query.points || 180), 20), 2000);
    const stepMs = 60_000;

    const rows = pmDb
      .prepare(
        `
        SELECT ts, price, volume
        FROM pm_snapshots
        WHERE slug = ?
        ORDER BY ts DESC
        LIMIT ?
      `
      )
      .all(slug, points);

    const hasReal = Array.isArray(rows) && rows.length >= 10;

    const priceSeries = hasReal
      ? (function () {
          const sorted = [...rows].sort(
            (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
          );

          const out = [];
          for (const r of sorted) {
            const v = r.price != null ? Number(r.price) : null;
            if (v == null || Number.isNaN(v)) continue;
            out.push({ t: new Date(r.ts).toISOString(), v: Number(v.toFixed(4)) });
          }
          return out.slice(Math.max(0, out.length - points));
        })()
      : makeSeries(slug, points);

    // ✅ data-present flag (works for real OR synthetic)
    const hasData = Array.isArray(priceSeries) && priceSeries.length >= 10;

    const latestPrice = priceSeries.length ? Number(priceSeries[priceSeries.length - 1].v) : null;
    const changePct = pctChange(priceSeries);
    const volatility = computeVolatility(priceSeries);

    const volumeSeries = makeSeries(`${slug}:vol`, points);

    const trend = computeTrend(priceSeries);
    const trendLabel = trend.dir === "up" ? "up" : trend.dir === "down" ? "down" : "flat";

    const tone = trend.dir === "up" ? "bullish" : trend.dir === "down" ? "bearish" : "neutral";
    const confidence = hasReal ? (trend.dir === "flat" ? 0.35 : 0.55) : trend.dir === "flat" ? 0.12 : 0.18;

    const verbal =
      trend.dir === "up"
        ? `Market behavior is tilting bullish for "${slug}".`
        : trend.dir === "down"
        ? `Market behavior is tilting bearish for "${slug}".`
        : `Market behavior is currently neutral for "${slug}". No dominant pressure detected.`;

    res.json({
      slug,
      asOf: new Date().toISOString(),
      narrative: {
        modeDefault: "verbal",
        verbal,
        visualHint: "Toggle to visual for structure.",
        confidence: Number(confidence.toFixed(2)),
        tone,

        trend: trendLabel,
        changePct: Number(changePct.toFixed(4)),
        latestPrice: latestPrice != null ? Number(latestPrice.toFixed(4)) : null,
        volatility: Number(volatility.toFixed(6)),
      },
      behavior: {
        layers: [
          {
            id: "price",
            label: "Price",
            status: hasData ? (trend.dir === "flat" ? "static" : "shifting") : "static",
            summary: hasData
              ? `Trend: ${trend.dir} • Δ=${trend.delta} • ${Math.round(changePct * 100)}%`
              : "Not evaluated yet.",
            metrics: hasData
              ? { trendDir: trend.dir, delta: trend.delta, latestPrice, changePct, volatility }
              : {},
          },
          {
            id: "volume",
            label: "Volume",
            status: hasData ? "building" : "static",
            summary: hasData ? "Tracking snapshots (volume eval next)." : "Not evaluated yet.",
            metrics: {},
          },
          {
            id: "news",
            label: "News",
            status: "static",
            summary: "Not wired yet (future: headlines + spikes).",
            metrics: {},
          },
        ],
        ruleVersion: "0.0.2",
      },
      series: {
        meta: { points, stepMs, source: hasReal ? "pm_snapshots" : "synthetic" },
        price: priceSeries,
        volume: volumeSeries,
      },
      meta: { contractVersion: "1.0.0" },
    });
  } catch (err) {
    console.error("❌ /api/narrative error:", err);
    res.status(500).json({
      error: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
});

/* ===============================
   Serve MAIN frontend (web/dist)
   =============================== */

const webDistDir = path.join(__dirname, "..", "web", "dist");
const webIndex = path.join(webDistDir, "index.html");

if (fs.existsSync(webIndex)) {
  app.use(express.static(webDistDir));

  // SAFE SPA fallback: matches anything NOT starting with /api/
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(webIndex);
  });
} else {
  console.warn("⚠️ web/dist not found. Run: npm --prefix web run build");
}

/* ===============================
   Start server
   =============================== */

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
});

server.on("error", (err) => {
  console.error("❌ listen error:", err);
  process.exit(1);
});
