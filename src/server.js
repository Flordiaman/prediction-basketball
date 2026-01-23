// E:\prediction_basketball\src\server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const { db, init, DB_PATH } = require("../db.js");
init();

const polymarket = require("./polymarket");
const { openNbaDb } = require("./nbaDb");
const makeNbaRouter = require("./nbaRouter"); // ✅
const { openPmDb } = require("./pmDb");

const app = express();
app.use(cors());
app.use(express.json());

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
function bdlHeaders() {
  const key = (process.env.BALLDONTLIE_API_KEY || "").trim();
  if (!key) return {};
  return { Authorization: key, "X-API-Key": key };
}

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

  pmDb.prepare(`
    INSERT INTO pm_markets (slug, league, title, active, updated_at)
    VALUES (@slug, @league, @title, 1, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      league=excluded.league,
      title=excluded.title,
      active=1,
      updated_at=datetime('now')
  `).run({ slug, league, title });

  res.json({ ok: true, slug, title, league });
});

// Save (or update) a market slug from the UI (manual)
app.post("/api/db/markets", (req, res) => {
  const slug = String(req.body.slug || "").trim();
  const league = String(req.body.league || "").trim();
  const title = String(req.body.title || "").trim();

  if (!slug) return res.status(400).json({ error: "Missing slug" });

  pmDb.prepare(`
    INSERT INTO pm_markets (slug, league, title, active, updated_at)
    VALUES (@slug, @league, @title, 1, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      league=excluded.league,
      title=excluded.title,
      active=1,
      updated_at=datetime('now')
  `).run({ slug, league, title });

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
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const m = await polymarket.getMarketBySlug(slug);
    if (!m) return res.status(404).json({ error: "Market not found" });

    const r = m.raw || {};
    const price = r.lastTradePrice != null ? Number(r.lastTradePrice) : null;
    const bestBid = r.bestBid != null ? Number(r.bestBid) : null;
    const bestAsk = r.bestAsk != null ? Number(r.bestAsk) : null;
    const volume = r.volume != null ? Number(r.volume) : null;

    pmDb.prepare(`
      INSERT INTO pm_snapshots (slug, ts, price, best_bid, best_ask, volume, raw_json)
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
    `).run(slug, price, bestBid, bestAsk, volume, JSON.stringify(m));

    res.json({ ok: true, slug, price, ts: new Date().toISOString() });
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

      const price = r.lastTradePrice != null ? Number(r.lastTradePrice) : null;
      const bestBid = r.bestBid != null ? Number(r.bestBid) : null;
      const bestAsk = r.bestAsk != null ? Number(r.bestAsk) : null;
      const volume = r.volume != null ? Number(r.volume) : null;

      pmDb.prepare(`
        INSERT INTO pm_snapshots (slug, ts, price, best_bid, best_ask, volume, raw_json)
        VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
      `).run(slug, price, bestBid, bestAsk, volume, JSON.stringify(m));
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
// 5) IMPORTANT: API 404 MUST BE JSON
// -------------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found", path: req.originalUrl });
});

// -------------------------
// 6) STATIC + SPA FALLBACK (LAST)
// -------------------------
app.use(express.static(path.join(__dirname, "public")));
app.use("/nba", express.static(path.join(__dirname, "nba_public"), { index: "index.html" }));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -------------------------
// 7) LISTEN
// -------------------------
const port = Number(process.env.PORT || 3001);
app.listen(port, "0.0.0.0", () => {
  console.log(`API running on http://127.0.0.1:${port}`);
});
