require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { db, init } = require("../db.js");
init();

const polymarket = require("./polymarket");
const { searchMarkets, getMarketTypes } = polymarket;

console.log("POLYMARKET EXPORTS:", Object.keys(polymarket));
console.log("SERVER.JS STARTED");



const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/db/ping", (req, res) => {
  try {
    const row = db.prepare("SELECT 1 AS ok").get();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const path = require("path");
app.use(express.static(path.join(__dirname, "public")));


app.get("/health", (req, res) => res.json({ ok: true }));

// What marketTypes exist (from our own known list)
app.get("/api/marketTypes", (req, res) => {
  res.json({ marketTypes: getMarketTypes() });
});

// Generic search (no filtering)
app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Number(req.query.limit || 25);
    if (!q) return res.status(400).json({ error: "Missing q" });

    const results = await searchMarkets(q, limit);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/**
 * NBA filtering helpers
 */
const NBA_TEAMS = [
  "atlanta hawks","boston celtics","brooklyn nets","charlotte hornets","chicago bulls",
  "cleveland cavaliers","dallas mavericks","denver nuggets","detroit pistons",
  "golden state warriors","houston rockets","indiana pacers","los angeles clippers",
  "la clippers","los angeles lakers","la lakers","memphis grizzlies","miami heat",
  "milwaukee bucks","minnesota timberwolves","new orleans pelicans","new york knicks",
  "oklahoma city thunder","orlando magic","philadelphia 76ers","phoenix suns",
  "portland trail blazers","sacramento kings","san antonio spurs","toronto raptors",
  "utah jazz","washington wizards",
  // common short names
  "hawks","celtics","nets","hornets","bulls","cavaliers","cavs","mavericks","mavs",
  "nuggets","pistons","warriors","rockets","pacers","clippers","lakers","grizzlies",
  "heat","bucks","timberwolves","wolves","pelicans","knicks","thunder","magic",
  "76ers","sixers","suns","blazers","trail blazers","kings","spurs","raptors","jazz","wizards",
];

const NEGATIVE_NOISE = [
  "coinbase","xrp","ripple","market cap","app store","delist","crypto",
  "president","election","senate","house","ukraine","gaza"
];

function toText(m) {
  const parts = [
    m?.question,
    m?.title,
    m?.slug,
    m?.eventTitle,
    m?.eventSlug,
    m?.eventSubtitle,
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function scoreNBA(m) {
  const text = toText(m);

  let score = 0;

  // strong positives
  if (text.includes(" nba ")) score += 10;
  if (text.includes("nba")) score += 6;
  if (text.includes("basketball")) score += 4;
  if (text.includes("playoffs") || text.includes("finals") || text.includes("western conference") || text.includes("eastern conference")) score += 3;

  // team matches
  for (const t of NBA_TEAMS) {
    if (text.includes(t)) score += 5;
  }

  // negative noise (only matters if we don't have a clear nba signal)
  let negHits = 0;
  for (const n of NEGATIVE_NOISE) {
    if (text.includes(n)) negHits += 1;
  }
  if (negHits > 0 && score < 8) score -= 20;

  return score;
}

function isOpenMarket(m) {
  // Polymarket data often includes active/closed booleans
  if (m && typeof m.closed === "boolean") return m.closed === false;
  if (m && typeof m.active === "boolean" && typeof m.closed === "boolean") return m.active === true && m.closed === false;
  // fallback: if we can't tell, don't auto-drop it
  return true;
}

function withinNextDays(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return d >= now && d <= future;
}

/**
 * NBA-only search endpoint
 * Example:
 *   /api/nba/search?q=nba&onlyOpen=true&days=14&limit=200
 * Returns: { q, onlyOpen, days, pages_scanned, hits_count, hits: [...] }
 */
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
      m.raw?.outcomePrices ?? null,
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

  if (pollers.has(slug)) {
    return res.json({ ok: true, slug, note: "already running" });
  }

  const id = setInterval(async () => {
    try {
      // call the same logic by hitting the handler internals:
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
        m.raw?.outcomePrices ?? null,
        JSON.stringify({ market: m.raw, event: ev })
      );

      // optional: stop when game ends
      if (ev?.ended === true) {
        clearInterval(id);
        pollers.delete(slug);
      }
    } catch (e) {
      // keep running even if one poll fails
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
async function collectOneSlug(slug) {
  const m = await polymarket.getMarketBySlug(slug);
  const ev = Array.isArray(m?.raw?.events) ? m.raw.events[0] : null;

  const ts = new Date().toISOString();

  const market_type = m.raw?.sportsMarketType ?? m.sportsMarketType ?? null;
  const sport = "sports";
  const league = "NBA";

  // Upsert market metadata
  db.prepare(`
    INSERT INTO markets (slug, title, sport, league, market_type, start_time, end_time, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title,
      sport=excluded.sport,
      league=excluded.league,
      market_type=excluded.market_type,
      start_time=excluded.start_time,
      end_time=excluded.end_time,
      updated_at=excluded.updated_at
  `).run(
    slug,
    m.title || m.question || slug,
    sport,
    league,
    market_type,
    ev?.startTime ?? null,
    m.endDate ?? null,
    ts
  );

  const bestBid = m.raw?.bestBid ?? null;
  const bestAsk = m.raw?.bestAsk ?? null;
  const lastTrade = m.raw?.lastTradePrice ?? null;
  const spread = (bestBid != null && bestAsk != null) ? (Number(bestAsk) - Number(bestBid)) : null;

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
    bestBid,
    bestAsk,
    lastTrade,
    m.raw?.outcomePrices ? JSON.stringify(m.raw.outcomePrices) : null,
    JSON.stringify({ market: m.raw, event: ev })
  );

  return { ok: true, slug, ts };
}
const multiPoller = {
  intervalId: null,
  slugs: new Set(),
  everySec: 10,
  lastRun: null,
  lastErrors: []
};

app.post("/api/collector/start", (req, res) => {
  const slugs = Array.isArray(req.body.slugs) ? req.body.slugs : [];
  const everySec = Number(req.body.everySec || 10);

  if (slugs.length === 0) return res.status(400).json({ error: "Provide slugs: []" });
  if (!Number.isFinite(everySec) || everySec < 3 || everySec > 120) {
    return res.status(400).json({ error: "everySec must be 3..120" });
  }

  slugs.forEach(s => multiPoller.slugs.add(String(s).trim()).delete(""));

  multiPoller.everySec = everySec;

  if (!multiPoller.intervalId) {
    multiPoller.intervalId = setInterval(async () => {
      const now = new Date().toISOString();
      multiPoller.lastRun = now;

      for (const slug of multiPoller.slugs) {
        if (!slug) continue;
        try {
          await collectOneSlug(slug);
        } catch (e) {
          multiPoller.lastErrors.unshift({ ts: now, slug, error: String(e.message || e) });
          multiPoller.lastErrors = multiPoller.lastErrors.slice(0, 20);
        }
      }
    }, everySec * 1000);
  }

  res.json({ ok: true, running: true, everySec: multiPoller.everySec, slugs: Array.from(multiPoller.slugs) });
});

app.post("/api/collector/stop", (req, res) => {
  if (multiPoller.intervalId) clearInterval(multiPoller.intervalId);
  multiPoller.intervalId = null;
  res.json({ ok: true, running: false });
});

app.post("/api/collector/slugs/add", (req, res) => {
  const slugs = Array.isArray(req.body.slugs) ? req.body.slugs : [];
  slugs.forEach(s => multiPoller.slugs.add(String(s).trim()).delete(""));
  res.json({ ok: true, slugs: Array.from(multiPoller.slugs) });
});

app.post("/api/collector/slugs/remove", (req, res) => {
  const slugs = Array.isArray(req.body.slugs) ? req.body.slugs : [];
  slugs.forEach(s => multiPoller.slugs.delete(String(s).trim()));
  res.json({ ok: true, slugs: Array.from(multiPoller.slugs) });
});

app.get("/api/collector/status", (req, res) => {
  res.json({
    running: Boolean(multiPoller.intervalId),
    everySec: multiPoller.everySec,
    slugs: Array.from(multiPoller.slugs),
    lastRun: multiPoller.lastRun,
    lastErrors: multiPoller.lastErrors
  });
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

// get snapshots for a slug, with date range for "one month later" comparisons
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

const port = Number(process.env.PORT || 5174);
// Listen on all interfaces so localhost/127.0.0.1 works consistently
app.listen(port, "0.0.0.0", () => console.log(`API running on http://127.0.0.1:${port}`));
