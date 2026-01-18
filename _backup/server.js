// src/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { db, init } = require("./db");


init();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Health ----------
app.get("/health", (req, res) => res.json({ ok: true }));
const { getSportsMarketTypes, getMarkets, clobBook } = require("./polymarket");

app.get("/api/pm/nba", async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const pages = Math.min(Number(req.query.pages || 10), 40);
    const pageSize = Math.min(Number(req.query.pageSize || 200), 200);

    const now = Date.now();
    const horizon = now + days * 24 * 60 * 60 * 1000;

    // NBA-ish keywords (teams + league)
    const needles = [
      " nba ", "nba:", "nba-", "national basketball",
      "lakers","warriors","celtics","knicks","nets","suns","nuggets","bucks","sixers","76ers",
      "heat","bulls","mavericks","clippers","kings","pelicans","jazz","rockets","spurs",
      "thunder","timberwolves","trail blazers","blazers","raptors","hawks","magic","pacers",
      "cavaliers","cavs","hornets","wizards","pistons","grizzlies"
    ];

    const hits = [];

    for (let i = 0; i < pages; i++) {
      const offset = i * pageSize;

      // Pull active sports-ish markets: active=true, closed=false
      const markets = await getMarkets({
        active: true,
        closed: false,
        archived: false,
        limit: pageSize,
        offset
      });

      const arr = Array.isArray(markets) ? markets : [];
      if (!arr.length) break;

      for (const m of arr) {
        const text = `${m.question || ""} ${m.title || ""} ${m.description || ""}`.toLowerCase();

        // Must have clobTokenIds to be tradable via CLOB
        if (!m.clobTokenIds) continue;

        // Time window if endDate exists
        if (m.endDate) {
          const end = Date.parse(m.endDate);
          if (Number.isFinite(end) && (end < now || end > horizon)) continue;
        }

        // Keyword match
        const match = needles.some((k) => text.includes(k.trim()));
        if (!match) continue;

        hits.push(m);
      }

      // Stop early once we have enough
      if (hits.length >= 50) break;
    }

    res.json({
      days,
      pages_scanned: pages,
      count: hits.length,
      markets: hits.slice(0, 50).map((m) => ({
        id: m.id,
        question: m.question || m.title,
        slug: m.slug,
        endDate: m.endDate || null,
        // This is what we need for live orderbooks
        clobTokenIds: m.clobTokenIds,
        outcomes: m.outcomes,
        outcomePrices: m.outcomePrices
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ---------- Polymarket: find NBA markets ----------
app.get("/api/pm/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const pages = Math.min(Number(req.query.pages || 8), 25);
    const pageSize = Math.min(Number(req.query.pageSize || 100), 200);

    const onlyOpen = (req.query.open ?? "1") !== "0";     // default ON
    const days = Number(req.query.days || 14);            // default next 14 days

    if (!q) return res.status(400).json({ error: "Use ?q=nba or ?q=lakers" });

    const hits = await searchGammaMarkets({ q, pages, pageSize });

    const now = Date.now();
    const horizon = now + days * 24 * 60 * 60 * 1000;

    // Gamma fields vary; we’ll handle both endDate / end_date etc.
    function parseEnd(m) {
      const d = m.endDate || m.end_date || m.expirationDate || m.expiration_date;
      const t = d ? Date.parse(d) : NaN;
      return Number.isFinite(t) ? t : null;
    }

    const filtered = hits.filter((m) => {
      const endTs = parseEnd(m);
      const isClosed = Boolean(m.closed);
      const isActive = m.active === true || m.active === "true";

      if (!onlyOpen) return true;

      // Must be active and not closed
      if (!isActive || isClosed) return false;

      // If we can parse an end date, keep only near-future
      if (endTs != null) return endTs >= now && endTs <= horizon;

      // If no end date, still allow it (some markets omit it)
      return true;
    });

    const trimmed = filtered.slice(0, 50).map((m) => ({
      id: m.id,
      question: m.question || m.title,
      slug: m.slug,
      active: m.active,
      closed: m.closed,
      endDate: m.endDate || m.end_date || null,
      outcomes: m.outcomes,
      outcomePrices: m.outcomePrices,
    }));

    res.json({
      q,
      onlyOpen,
      days,
      hits_count: filtered.length,
      hits: trimmed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Polymarket: orderbook (live price) for a YES/NO token_id ----------
app.get("/api/pm/book/:token_id", async (req, res) => {
  try {
    const token_id = req.params.token_id;
    const data = await clobBook(token_id);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Your local "games" DB endpoints (unchanged) ----------
app.post("/games", (req, res) => {
  const {
    id,
    league = "NBA",
    season,
    game_date,
    home_team,
    away_team,
    status = "scheduled",
  } = req.body;

  if (!id || !game_date || !home_team || !away_team) {
    return res.status(400).json({
      error: "Missing required fields: id, game_date, home_team, away_team",
    });
  }

  const stmt = db.prepare(`
    INSERT INTO games (id, league, season, game_date, home_team, away_team, status)
    VALUES (@id, @league, @season, @game_date, @home_team, @away_team, @status)
    ON CONFLICT(id) DO UPDATE SET
      league=excluded.league,
      season=excluded.season,
      game_date=excluded.game_date,
      home_team=excluded.home_team,
      away_team=excluded.away_team,
      status=excluded.status
  `);

  stmt.run({ id, league, season, game_date, home_team, away_team, status });
  res.json({ ok: true, id });
});

app.get("/games", (req, res) => {
  const { date } = req.query;

  const rows = date
    ? db.prepare(`SELECT * FROM games WHERE game_date = ?`).all(date)
    : db.prepare(`SELECT * FROM games ORDER BY game_date DESC LIMIT 200`).all();

  res.json(rows);
});

app.post("/games/:id/score", (req, res) => {
  const game_id = req.params.id;
  const { ts, period, clock, home_score, away_score, source } = req.body;

  if (!ts || home_score == null || away_score == null) {
    return res.status(400).json({
      error: "Missing required fields: ts, home_score, away_score",
    });
  }

  const stmt = db.prepare(`
    INSERT INTO score_snapshots (game_id, ts, period, clock, home_score, away_score, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    game_id,
    ts,
    period ?? null,
    clock ?? null,
    home_score,
    away_score,
    source ?? null
  );

  db.prepare(`UPDATE games SET status='live' WHERE id=? AND status!='final'`).run(game_id);

  res.json({ ok: true });
});

app.post("/games/:id/market", (req, res) => {
  const game_id = req.params.id;
  const { ts, market, venue, price, raw } = req.body;

  if (!ts || !market || !venue || price == null) {
    return res.status(400).json({
      error: "Missing required fields: ts, market, venue, price",
    });
  }

  const stmt = db.prepare(`
    INSERT INTO market_snapshots (game_id, ts, market, venue, price, raw)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(game_id, ts, market, venue, price, raw ? JSON.stringify(raw) : null);

  res.json({ ok: true });
});

app.get("/games/:id", (req, res) => {
  const game_id = req.params.id;

  const game = db.prepare(`SELECT * FROM games WHERE id=?`).get(game_id);
  if (!game) return res.status(404).json({ error: "Game not found" });

  const scores = db
    .prepare(`SELECT * FROM score_snapshots WHERE game_id=? ORDER BY ts DESC LIMIT 300`)
    .all(game_id);

  const markets = db
    .prepare(`SELECT * FROM market_snapshots WHERE game_id=? ORDER BY ts DESC LIMIT 300`)
    .all(game_id);

  res.json({ game, scores, markets });
});

// ---------- Server ----------
const port = Number(process.env.PORT || 5174);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));


