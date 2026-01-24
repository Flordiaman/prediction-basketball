// E:\prediction_basketball\src\server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const { db, init, DB_PATH } = require("../db.js");
init();

const polymarket = require("./polymarket");
const { openNbaDb } = require("./nbaDb");
const makeNbaRouter = require("./nbaRouter");
const { openPmDb } = require("./pmDb");

const app = express();
app.use(cors());
app.use(express.json());

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


// -------------------------
// Helpers
// -------------------------
function bdlHeaders() {
  const key = (process.env.BALLDONTLIE_API_KEY || "").trim();
  if (!key) return {};
  // Some providers accept either Authorization or X-API-Key; we send both.
  return { Authorization: key, "X-API-Key": key };
}

function makeSeries(slug, points = 180) {
  // deterministic pseudo-series per slug (stable line each refresh)
  let seed = 0;
  for (let i = 0; i < slug.length; i++) seed = (seed * 31 + slug.charCodeAt(i)) >>> 0;

  function rand() {
    // xorshift32
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >> 17;
    seed >>>= 0;
    seed ^= seed << 5;
    seed >>>= 0;
    return (seed >>> 0) / 4294967296;
  }

  const now = Date.now();
  const stepMs = 60 * 1000; // 1 min spacing
  let v = 0.52 + rand() * 0.08; // start around 0.52-0.60

  const series = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now - i * stepMs).toISOString();
    // gentle drift + noise
    v += (rand() - 0.5) * 0.01 + 0.0005;
    v = Math.max(0.01, Math.min(0.99, v));
    series.push({ t, v: Number(v.toFixed(4)) });
  }
  return series;
}

// -------------------------
// NBA (isolated)
// -------------------------
const nbaOpened = openNbaDb();
const nbaDb = nbaOpened.db;
app.use("/api/nba", makeNbaRouter(nbaDb, { NBA_DB_PATH: nbaOpened.NBA_DB_PATH }));

// Mount your existing DB history router (keep this)
try {
  const nbaHistory = require("../server/routes/nbahistory");
  app.use("/api/nba/db", nbaHistory);
} catch (e) {
  console.log("nbaHistory router not loaded:", e?.message || e);
}

// -------------------------
// 1) HEALTH + DB DEBUG
// -------------------------
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/db/ping", (req, res) => {
  try {
    const row = db.prepare("SELECT 1 AS ok").get();
    res.json({ ...row, db: DB_PATH });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/db/tables", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();
    res.json(rows.map((r) => r.name));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// -------------------------
// 2) PLAYERS: IMPORT + SEARCH (DB-backed)
// -------------------------
app.post("/api/nba/db/players/import", async (req, res) => {
  try {
    const perPage = Math.min(Number(req.body.per_page || 100), 100);
    const maxPages = Math.min(Number(req.body.max_pages || 200), 500);

    const baseUrl = (process.env.BALLDONTLIE_BASE_URL || "https://api.balldontlie.io/v1").replace(
      /\/+$/,
      ""
    );

    const headers = bdlHeaders();
    let page = 1;
    let totalUpserted = 0;

    const upsert = db.prepare(`
      INSERT INTO players (
        person_id, first_name, last_name, display_first_last,
        team_id, team_abbreviation, provider, raw, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(person_id) DO UPDATE SET
        first_name=excluded.first_name,
        last_name=excluded.last_name,
        display_first_last=excluded.display_first_last,
        team_id=excluded.team_id,
        team_abbreviation=excluded.team_abbreviation,
        provider=excluded.provider,
        raw=excluded.raw,
        updated_at=excluded.updated_at
    `);

    const tx = db.transaction((rows, now) => {
      for (const p of rows) {
        const team = p.team || {};
        const first = p.first_name ?? "";
        const last = p.last_name ?? "";
        const display = p.display_first_last ?? `${first} ${last}`.trim();

        upsert.run(
          Number(p.id),
          String(first),
          String(last),
          String(display),
          team?.id != null ? Number(team.id) : null,
          team?.abbreviation != null ? String(team.abbreviation) : null,
          "balldontlie",
          JSON.stringify(p),
          now
        );
      }
    });

    while (page <= maxPages) {
      const url = `${baseUrl}/players?per_page=${perPage}&page=${page}`;
      const resp = await fetch(url, { headers });

      if (!resp.ok) {
        const text = await resp.text();
        return res.status(500).json({
          error: `BallDontLie HTTP ${resp.status}`,
          detail: text.slice(0, 800),
        });
      }

      const json = await resp.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (rows.length === 0) break;

      const now = new Date().toISOString();
      tx(rows, now);
      totalUpserted += rows.length;

      const nextPage = json?.meta?.next_page;
      if (!nextPage) break;
      page = Number(nextPage);
    }

    res.json({ ok: true, imported: totalUpserted });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/nba/db/players/search", (req, res) => {
  const q = (req.query.q || "").trim();
  const limit = Math.min(parseInt(req.query.limit || "25", 10), 100);
  if (!q) return res.json([]);

  try {
    const sql = `
      SELECT person_id, first_name, last_name, display_first_last, team_id, team_abbreviation
      FROM players
      WHERE display_first_last LIKE ?
         OR first_name LIKE ?
         OR last_name LIKE ?
      ORDER BY last_name ASC
      LIMIT ?
    `;
    const like = `%${q}%`;
    const rows = db.prepare(sql).all(like, like, like, limit);
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// -------------------------
// 3) POLYMARKET API + DB
// -------------------------
console.log("POLYMARKET EXPORTS:", Object.keys(polymarket));
console.log("SERVER.JS STARTED");
console.log("SQLITE PATH:", DB_PATH);

const pmDb = openPmDb();

// market types
app.get("/api/marketTypes", (req, res) => {
  res.json({ marketTypes: polymarket.getMarketTypes?.() ?? [] });
});

// generic search
app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Number(req.query.limit || 25);
    if (!q) return res.status(400).json({ error: "Missing q" });

    if (!polymarket.searchMarkets) {
      return res.status(500).json({ error: "polymarket.searchMarkets not available" });
    }
    const results = await polymarket.searchMarkets(q, limit);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Save search result object (or minimal slug/title/league)
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

// Save (or update) a market slug from the UI (manual)
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

// list saved markets
app.get("/api/db/markets", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const league = String(req.query.league || "").trim().toLowerCase();
  const sort = String(req.query.sort || "updated_at");
  const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 1000);

  const sortCol = ["updated_at", "slug", "league", "title"].includes(sort) ? sort : "updated_at";

  let where = "1=1";
  const params = {};

  if (q) {
    where += " AND (lower(slug) LIKE @q OR lower(title) LIKE @q)";
    params.q = `%${q}%`;
  }
  if (league) {
    where += " AND lower(league) = @league";
    params.league = league;
  }

  const rows = pmDb
    .prepare(
      `
    SELECT slug, league, title, active, updated_at
    FROM pm_markets
    WHERE ${where}
    ORDER BY ${sortCol} ${dir}
    LIMIT @limit
  `
    )
    .all({ ...params, limit });

  res.json({ rows });
});

// snapshots for a slug
app.get("/api/db/snapshots", (req, res) => {
  const slug = String(req.query.slug || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 5000);
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();

  if (!slug) return res.status(400).json({ error: "Missing slug" });

  let where = "slug = @slug";
  const params = { slug, limit };

  if (from) {
    where += " AND ts >= @from";
    params.from = from;
  }
  if (to) {
    where += " AND ts <= @to";
    params.to = to;
  }

  const rows = pmDb
    .prepare(
      `
    SELECT ts, price, best_bid, best_ask, volume
    FROM pm_snapshots
    WHERE ${where}
    ORDER BY ts DESC
    LIMIT @limit
  `
    )
    .all(params);

  res.json({ rows });
});

// get one polymarket market by slug (metadata + raw fields)
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

// collect ONE snapshot for a slug
app.post("/api/collector/collect-one", async (req, res) => {
  try {
    const slug = String(req.body.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const m = await polymarket.getMarketBySlug(slug);
    if (!m) {
      return res.status(404).json({ error: "Market not found" });
    }

    const r = m.raw ?? {};

    const price = canonicalPrice(r);
    const bestBid = r.bestBid != null ? Number(r.bestBid) : null;
    const bestAsk = r.bestAsk != null ? Number(r.bestAsk) : null;
    const volume  = r.volume  != null ? Number(r.volume)  : null;

    const safe = (x) => (x == null || Number.isNaN(x) ? null : x);

    pmDb.prepare(`
      INSERT INTO pm_snapshots (
        slug,
        ts,
        price,
        best_bid,
        best_ask,
        volume,
        raw_json
      )
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
    `).run(
      slug,
      safe(price),
      safe(bestBid),
      safe(bestAsk),
      safe(volume),
      JSON.stringify(m)
    );

    res.json({
      ok: true,
      slug,
      price: safe(price),
      ts: new Date().toISOString(),
    });

  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// -------------------------
// 4) COLLECTOR (interval)
// -------------------------
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

  // Optional: accept slugs from UI and persist them
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

// (optional) auto-start after boot
setTimeout(() => {
  if (collectorTimer) return;
  collectorState.running = true;
  collectAllOnce().catch(() => {});
  collectorTimer = setInterval(() => collectAllOnce().catch(() => {}), collectorState.everySec * 1000);
}, 3000);

// -------------------------
// Narrative helpers (REAL snapshots if available, fallback otherwise)
// -------------------------
function seriesFromSnapshots(rows, points = 180) {
  // rows expected newest-first OR any order; normalize oldest->newest
  const sorted = [...rows].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  // Map ts -> ISO time, price -> v
  const out = [];
  for (const r of sorted) {
    const t = new Date(r.ts).toISOString();
    const v = r.price != null ? Number(r.price) : null;
    if (v == null || Number.isNaN(v)) continue;
    out.push({ t, v: Number(v.toFixed(4)) });
  }

  // If too many points, keep last N
  if (out.length > points) return out.slice(out.length - points);
  return out;
}

function lastN(arr, n) {
  if (arr.length <= n) return arr;
  return arr.slice(arr.length - n);
}

function computeTrend(series) {
  if (!series || series.length < 10) return { dir: "flat", delta: 0 };
  const first = series[0].v;
  const last = series[series.length - 1].v;
  const delta = last - first;

  const eps = 0.01; // tune later
  const dir = delta > eps ? "up" : delta < -eps ? "down" : "flat";
  return { dir, delta: Number(delta.toFixed(4)) };
}

app.get("/api/narrative/:slug", (req, res) => {
  const { slug } = req.params;

  const points = Math.min(Math.max(Number(req.query.points || 180), 20), 2000);
  const stepMs = 60_000;

  // try real snapshots first
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

  // price series
  const priceSeries = hasReal
    ? (function () {
        const sorted = [...rows].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        const out = [];
        for (const r of sorted) {
          const v = r.price != null ? Number(r.price) : null;
          if (v == null || Number.isNaN(v)) continue;
          out.push({ t: new Date(r.ts).toISOString(), v: Number(v.toFixed(4)) });
        }
        return out.slice(Math.max(0, out.length - points));
      })()
    : makeSeries(slug, points);

  // volume series (still synthetic unless you want real normalization)
  const volumeSeries = hasReal ? makeSeries(`${slug}:vol`, points) : makeSeries(`${slug}:vol`, points);

  // compute narrative from the SAME series we return
  const trend = computeTrend(priceSeries);

  const tone =
    trend.dir === "up" ? "bullish" :
    trend.dir === "down" ? "bearish" :
    "neutral";

  // keep confidence low when synthetic, higher when real
  const confidence =
    hasReal
      ? (trend.dir === "flat" ? 0.35 : 0.55)
      : (trend.dir === "flat" ? 0.12 : 0.18);

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
    },
    behavior: {
      layers: [
        {
          id: "price",
          label: "Price",
          status: hasReal ? (trend.dir === "flat" ? "static" : "shifting") : "static",
          summary: hasReal ? `Trend: ${trend.dir} (Δ=${trend.delta})` : "Not evaluated yet.",
          metrics: hasReal ? { trendDir: trend.dir, delta: trend.delta } : {},
        },
        { id: "volume", label: "Volume", status: hasReal ? "building" : "static", summary: "Not evaluated yet.", metrics: {} },
        { id: "news", label: "News", status: "static", summary: "Not evaluated yet.", metrics: {} },
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
});

// -------------------------
// 8) LISTEN
// -------------------------
const port = Number(process.env.PORT || 3001);
app.listen(port, "0.0.0.0", () => {
  console.log(`API running on http://127.0.0.1:${port}`);
});
