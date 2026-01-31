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


// ===== NBA SPEED BUILD ROUTES =====
app.get("/api/status", (req, res) => {
  res.json({
    lastUpdatedUtc: new Date().toISOString(),
    datasets: {
      games: { lastUpdatedUtc: new Date().toISOString() },
      players: { lastUpdatedUtc: new Date().toISOString() },
      teams: { lastUpdatedUtc: new Date().toISOString() },
      picks: { lastUpdatedUtc: new Date().toISOString() },
    }
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

  // SPEED BUILD: mock picks with a "model-ish" shape.
  // Later: replace `mockPicks` with real DB + model output.
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

  // Scoring helpers
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function scorePick(p) {
    const edge = p.projected - p.line; // positive = favor OVER, negative = favor UNDER
    const absEdge = Math.abs(edge);

    // volatility proxy (std dev). if missing, assume "medium"
    const vol = typeof p.last10_std === "number" ? p.last10_std : 5.0;

    // signal-to-noise: how big is the edge relative to volatility?
    const snr = absEdge / (vol || 1);

    // confidence: scale SNR into 0-100
    // SNR ~0.3 = low, ~0.7 = decent, ~1.2+ = strong
    const confidence = Math.round(clamp((snr / 1.2) * 100, 0, 100));

    // label
    let tier = "PASS";
    if (confidence >= 70) tier = "STRONG";
    else if (confidence >= 50) tier = "EDGE";
    else if (confidence >= 35) tier = "LEAN";

    // direction
    const side = edge >= 0 ? "OVER" : "UNDER";

    // warnings
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

// ===== END NBA SPEED BUILD ROUTES =====


/* ===============================
   Serve /nba/ static site
   =============================== */

const nbaDirDist = path.join(__dirname, "..", "web", "dist");

const nbaDirLocal = path.join(__dirname, "..", "web", "nba");
const nbaDirOld = path.join(__dirname, "..", "web", "nba-old");

const pickNbaDir = () => {
  if (fs.existsSync(path.join(nbaDirDist, "index.html"))) return nbaDirDist;
  if (fs.existsSync(path.join(nbaDirLocal, "index.html"))) return nbaDirLocal;
  if (fs.existsSync(path.join(nbaDirOld, "index.html"))) return nbaDirOld;
  return null;
};

const nbaDir = pickNbaDir();

if (nbaDir) {
  // serve assets
  app.use("/nba", express.static(nbaDir));

  // serve SPA shell for BOTH /nba and /nba/
  app.get(["/nba", "/nba/"], (req, res) => {
    res.sendFile(path.join(nbaDir, "index.html"));
  });

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
  // Some endpoints accept either header; we send both.
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
  const stepMs = 60 * 1000; // 1 min spacing
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

app.use("/api/nba", makeNbaRouter(nbaDb, { NBA_DB_PATH: nbaOpened.NBA_DB_PATH }));

// Optional: mount existing history router if present
try {
  const nbaHistory = require("../server/routes/nbahistory");
  app.use("/api/nba/history", nbaHistory);
} catch (e) {
  console.log("nbaHistory router not loaded:", e?.message || e);
}

/* ===============================
   PM DB (for markets + snapshots)
   =============================== */


const pmOpened = {
  db: openPmDb(),
};

const pmDb = pmOpened.db;


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

/* ===============================
   NBA DB debug endpoints
   =============================== */

app.get("/api/nba/_debug/tables", (req, res) => {
  try {
    const rows = nbaDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();
    res.json({
      ok: true,
      nbaDbPath: nbaOpened?.NBA_DB_PATH,
      tables: rows.map((r) => r.name),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get("/api/nba/_debug/players_sample", (req, res) => {
  try {
    const row = nbaDb.prepare("SELECT * FROM players LIMIT 1").get();
    res.json({ ok: true, nbaDbPath: nbaOpened?.NBA_DB_PATH, row: row || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* ===============================
   Players: import + search
   =============================== */

// Import players into MAIN db (your existing players table)
app.post("/api/nba/db/players/import", async (req, res) => {
  try {
    const perPage = Math.min(Number(req.body.per_page || 100), 100);
    const maxPages = Math.min(Number(req.body.max_pages || 200), 500);

    const baseUrl = (process.env.BALLDONTLIE_BASE_URL || "https://api.balldontlie.io/v1").replace(
      /\/+$/,
      ""
    );

    const headers = bdlHeaders();
    let cursor = null;
    let loops = 0;
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

    while (loops < maxPages) {
      const url =
        `${baseUrl}/players?per_page=${perPage}` +
        (cursor != null ? `&cursor=${encodeURIComponent(cursor)}` : "");

      const resp = await fetchWith429Retry(url, { headers }, { maxRetries: 10, baseDelayMs: 1200 });

      if (!resp.ok) {
        const text = await resp.text();
        return res.status(500).json({
          error: `BallDontLie HTTP ${resp.status}`,
          detail: text.slice(0, 800),
          loops,
          imported: totalUpserted,
        });
      }

      const json = await resp.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (rows.length === 0) break;

      const now = new Date().toISOString();
      tx(rows, now);
      totalUpserted += rows.length;

      const nextCursor = json?.meta?.next_cursor;
      if (!nextCursor) break;

      cursor = nextCursor;
      loops += 1;

      await sleep(350);
    }

    res.json({ ok: true, imported: totalUpserted, loops });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// SEARCH PLAYERS (CSV nbaDb)
app.get("/api/nba/db/players/search", (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);

    if (q.length < 2) return res.json([]);

    const like = `%${q}%`;

    const rows = nbaDb
      .prepare(
        `
        SELECT
          person_id AS id,
          person_name,
          team_id,
          position
        FROM players
        WHERE lower(person_name) LIKE ?
        ORDER BY person_name
        LIMIT ?
        `
      )
      .all(like, limit);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// PLAYER LAST GAMES (CSV nbaDb)
app.get("/api/nba/db/player/:personId", (req, res) => {
  try {
    const personId = Number(req.params.personId);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 200);

    const rows = nbaDb
      .prepare(
        `
        SELECT
          b.game_id,
          b.game_date,
          b.season_year,

          b.team_tricode,
          b.opponent_tricode,
          b.is_home,

          b.minutes,

          b.fgm, b.fga, b.fg_pct,
          b.fg3m, b.fg3a, b.fg3_pct,
          b.ftm, b.fta, b.ft_pct,

          b.oreb, b.dreb, b.reb,
          b.ast, b.stl, b.blk,
          b.tov, b.pf,
          b.pts,
          b.plus_minus
        FROM box_scores b
        WHERE b.person_id = ?
        ORDER BY b.game_date DESC
        LIMIT ?
        `
      )
      .all(personId, limit);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* ===============================
   PM markets + snapshots
   =============================== */

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

/* ===============================
   PM API passthrough
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

// collect ONE snapshot for a slug
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

/* ===============================
   Collector (interval)
   =============================== */

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

// (optional) auto-start after boot
setTimeout(() => {
  if (collectorTimer) return;
  collectorState.running = true;
  collectAllOnce().catch(() => {});
  collectorTimer = setInterval(() => collectAllOnce().catch(() => {}), collectorState.everySec * 1000);
}, 3000);

/* ===============================
   Narrative
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


app.get("/api/narrative/:slug", (req, res) => {
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
  (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      const hasData = Array.isArray(priceSeries) && priceSeries.length >= 10;

        const out = [];
        for (const r of sorted) {
          const v = r.price != null ? Number(r.price) : null;
          if (v == null || Number.isNaN(v)) continue;
          out.push({ t: new Date(r.ts).toISOString(), v: Number(v.toFixed(4)) });
        }
        return out.slice(Math.max(0, out.length - points));
      })()
    : makeSeries(slug, points);

// priceSeries is already chronological (you sorted by ts ASC)
const latestPrice = priceSeries.length ? Number(priceSeries[priceSeries.length - 1].v) : null;
const changePct = pctChange(priceSeries);
const volatility = computeVolatility(priceSeries);

// you already compute trend somewhere later as `trend.dir` / `trend.delta`


  const volumeSeries = makeSeries(`${slug}:vol`, points);

  const trend = computeTrend(priceSeries);
  const tone = trend.dir === "up" ? "bullish" : trend.dir === "down" ? "bearish" : "neutral";
  const confidence = hasReal ? (trend.dir === "flat" ? 0.35 : 0.55) : trend.dir === "flat" ? 0.12 : 0.18;
  const trendLabel = trend.dir === "up" ? "up" : trend.dir === "down" ? "down" : "flat";


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

    // ✅ new
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
        status: hasReal ? "building" : "static",
        summary: hasReal ? "Tracking snapshots (volume eval next)." : "Not evaluated yet.",
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
});


/* ===============================
   Serve MAIN frontend (web/dist)
   =============================== */

// IMPORTANT: build first:  cd E:\prediction_basketball\web && npm run build
const webDistDir = path.join(__dirname, "..", "web", "dist");
const webIndex = path.join(webDistDir, "index.html");

if (fs.existsSync(webIndex)) {
  app.use(express.static(webDistDir));

 // SAFE SPA fallback:
// matches anything NOT starting with /api/
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(webIndex);
});

} else {
  console.warn("⚠️ web/dist not found. Run: npm --prefix web run build");
}

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
});


server.on("error", (err) => {
  console.error("❌ listen error:", err);
  process.exit(1);
});
