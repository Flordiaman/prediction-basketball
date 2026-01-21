// E:\prediction_basketball\src\server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { db, init, DB_PATH } = require("../db.js");
init();

const polymarket = require("./polymarket");
console.log("POLYMARKET EXPORTS:", Object.keys(polymarket));
console.log("SERVER.JS STARTED");
console.log("SQLITE PATH:", DB_PATH);

const app = express();
app.use(cors());
app.use(express.json());

// Keep your existing router mount
const nbaHistory = require("../server/routes/nbahistory");
app.use("/api/nba/db", nbaHistory);

// --- basic DB diagnostics ---
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
    res.json(rows.map(r => r.name));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * ====== Polymarket / NBA stuff you already had ======
 * (Left intact below; only trimmed where needed)
 */

// What marketTypes exist (from our own known list)
// NOTE: your original code referenced getMarketTypes/searchMarkets without importing.
// If those are exported by polymarket, call polymarket.getMarketTypes(), polymarket.searchMarkets()
app.get("/api/marketTypes", (req, res) => {
  res.json({ marketTypes: polymarket.getMarketTypes?.() ?? [] });
});

// Generic search (no filtering)
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

// SAVE ONE SNAPSHOT (manual trigger)
app.post("/api/nba/snapshot", async (req, res) => {
  try {
    const slug = String(req.body.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const m = await polymarket.getMarketBySlug(slug);
    const ev = Array.isArray(m?.raw?.events) ? m.raw.events[0] : null;

    const ts = new Date().toISOString();

    // Upsert game row
    db.prepare(`
      INSERT INTO games (slug, title, event_date, start_time, game_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title=excluded.title,
        event_date=excluded.event_date,
        start_time=excluded.start_time,
        game_id=excluded.game_id
    `).run(
      slug,
      m.title || m.question || slug,
      ev?.eventDate ?? null,
      ev?.startTime ?? null,
      ev?.gameId ?? null
    );

    // Insert snapshot row
    db.prepare(`
      INSERT INTO snapshots
      (slug, ts, live, ended, period, elapsed, score, best_bid, best_ask, last_trade, outcome_prices, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slug,
      ts,
      ev?.live ? 1 : 0,
      ev?.ended ? 1 : 0,
      ev?.period ?? null,
      ev?.elapsed ?? null,
      ev?.score ?? null,
      m.raw?.bestBid ?? null,
      m.raw?.bestAsk ?? null,
      m.raw?.lastTradePrice ?? null,
      m.raw?.outcomePrices ? JSON.stringify(m.raw.outcomePrices) : null,
      JSON.stringify({ market: m.raw, event: ev })
    );

    res.json({ ok: true, slug, ts });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// READ SNAPSHOT HISTORY
app.get("/api/nba/history", (req, res) => {
  try {
    const slug = String(req.query.slug || "").trim();
    const limit = Number(req.query.limit || 50);

    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const rows = db.prepare(`
      SELECT
        ts, live, ended, period, elapsed, score,
        best_bid, best_ask, last_trade,
        (best_ask - best_bid) AS spread
      FROM snapshots
      WHERE slug=?
      ORDER BY ts DESC
      LIMIT ?
    `).all(slug, Math.min(limit, 5000));

    res.json({ slug, count: rows.length, rows });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// --- simple in-server poller ---
const pollers = new Map(); // slug -> intervalId

app.post("/api/nba/poll/start", (req, res) => {
  const slug = String(req.body.slug || "").trim();
  const everySec = Number(req.body.everySec || 5);

  if (!slug) return res.status(400).json({ error: "Missing slug" });
  if (!Number.isFinite(everySec) || everySec < 2 || everySec > 60) {
    return res.status(400).json({ error: "everySec must be 2..60" });
  }

  if (pollers.has(slug)) return res.json({ ok: true, slug, note: "already running" });

  const id = setInterval(async () => {
    try {
      const m = await polymarket.getMarketBySlug(slug);
      const ev = Array.isArray(m?.raw?.events) ? m.raw.events[0] : null;
      const ts = new Date().toISOString();

      db.prepare(`
        INSERT INTO games (slug, title, event_date, start_time, game_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          title=excluded.title,
          event_date=excluded.event_date,
          start_time=excluded.start_time,
          game_id=excluded.game_id
      `).run(
        slug,
        m.title || m.question || slug,
        ev?.eventDate ?? null,
        ev?.startTime ?? null,
        ev?.gameId ?? null
      );

      db.prepare(`
        INSERT INTO snapshots
        (slug, ts, live, ended, period, elapsed, score, best_bid, best_ask, last_trade, outcome_prices, raw)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        slug,
        ts,
        ev?.live ? 1 : 0,
        ev?.ended ? 1 : 0,
        ev?.period ?? null,
        ev?.elapsed ?? null,
        ev?.score ?? null,
        m.raw?.bestBid ?? null,
        m.raw?.bestAsk ?? null,
        m.raw?.lastTradePrice ?? null,
        m.raw?.outcomePrices ? JSON.stringify(m.raw.outcomePrices) : null,
        JSON.stringify({ market: m.raw, event: ev })
      );

      if (ev?.ended === true) {
        clearInterval(id);
        pollers.delete(slug);
      }
    } catch (e) {
      console.error("poll error", slug, e.message || e);
    }
  }, everySec * 1000);

  pollers.set(slug, id);
  res.json({ ok: true, slug, everySec });
});

app.post("/api/nba/poll/stop", (req, res) => {
  const slug = String(req.body.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const id = pollers.get(slug);
  if (id) clearInterval(id);
  pollers.delete(slug);

  res.json({ ok: true, slug, stopped: true });
});

app.get("/api/nba/poll/status", (req, res) => {
  res.json({ running: Array.from(pollers.keys()) });
});

app.get("/api/nba/live", async (req, res) => {
  try {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const m = await polymarket.getMarketBySlug(slug);
    const ev = Array.isArray(m?.raw?.events) ? m.raw.events[0] : null;

    res.json({
      slug: m.slug,
      title: m.title || m.question,
      active: m.active,
      closed: m.closed,
      bestBid: m.raw?.bestBid,
      bestAsk: m.raw?.bestAsk,
      lastTradePrice: m.raw?.lastTradePrice,
      outcomes: m.raw?.outcomes,
      outcomePrices: m.raw?.outcomePrices,
      live: ev?.live ?? null,
      ended: ev?.ended ?? null,
      period: ev?.period ?? null,
      elapsed: ev?.elapsed ?? null,
      score: ev?.score ?? null,
      gameId: ev?.gameId ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// list markets you've collected, sortable
app.get("/api/db/markets", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const league = String(req.query.league || "").trim();
  const sort = String(req.query.sort || "updated_at").trim();
  const dir = (String(req.query.dir || "desc").toLowerCase() === "asc") ? "ASC" : "DESC";
  const limit = Math.min(Number(req.query.limit || 200), 1000);

  const allowed = new Set(["updated_at","created_at","end_time","start_time","title","slug","market_type"]);
  const sortCol = allowed.has(sort) ? sort : "updated_at";

  let sql = `SELECT slug, title, league, market_type, start_time, end_time, created_at, updated_at FROM markets WHERE 1=1`;
  const params = [];

  if (league) { sql += ` AND league=?`; params.push(league); }
  if (q) {
    sql += ` AND (lower(slug) LIKE ? OR lower(title) LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY ${sortCol} ${dir} LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, rows });
});

app.get("/api/db/snapshots", (req, res) => {
  const slug = String(req.query.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const limit = Math.min(Number(req.query.limit || 300), 5000);
  const from = String(req.query.from || "").trim(); // ISO
  const to = String(req.query.to || "").trim();     // ISO

  let sql = `
    SELECT
      ts, live, ended, period, elapsed, score,
      best_bid, best_ask, last_trade,
      (best_ask - best_bid) AS spread,
      outcome_prices
    FROM snapshots
    WHERE slug=?
  `;
  const params = [slug];

  if (from) { sql += ` AND ts >= ?`; params.push(from); }
  if (to) { sql += ` AND ts <= ?`; params.push(to); }

  sql += ` ORDER BY ts DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  res.json({ slug, count: rows.length, rows });
});

/**
 * ====== NEW: Players (DB-backed) ======
 *
 * 1) POST /api/nba/db/players/import
 *    - Pulls from BallDontLie and upserts into SQLite
 *
 * 2) GET /api/nba/db/players/search?q=le&limit=5
 */

function bdlHeaders() {
  const key = (process.env.BALLDONTLIE_API_KEY || "").trim();
  if (!key) return {};
  // Different providers / versions use different header names; we set both.
  return {
    "Authorization": key,
    "X-API-Key": key,
  };
}

// One-time import endpoint
app.post("/api/nba/db/players/import", async (req, res) => {
  try {
    // You can override per request if you want
    const perPage = Math.min(Number(req.body.per_page || 100), 100);
    const maxPages = Math.min(Number(req.body.max_pages || 200), 500);

    // BallDontLie v1 style:
    // GET https://api.balldontlie.io/v1/players?per_page=100&page=1
    const baseUrl = (process.env.BALLDONTLIE_BASE_URL || "https://api.balldontlie.io/v1").replace(/\/+$/, "");
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
          Number(p.id),                 // person_id
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
        return res.status(500).json({ error: `BallDontLie HTTP ${resp.status}`, detail: text.slice(0, 500) });
      }

      const json = await resp.json();
      const rows = Array.isArray(json?.data) ? json.data : [];

      if (rows.length === 0) break;

      const now = new Date().toISOString();
      tx(rows, now);

      totalUpserted += rows.length;

      // If meta exists and we’re at the end, stop.
      const nextPage = json?.meta?.next_page;
      if (!nextPage) break;

      page = Number(nextPage);
    }

    res.json({ ok: true, imported: totalUpserted });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Search players by name (DB-backed)
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
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---- PORT / LISTEN ----
const port = Number(process.env.PORT || 3001);
app.listen(port, "0.0.0.0", () => console.log(`API running on http://127.0.0.1:${port}`));
