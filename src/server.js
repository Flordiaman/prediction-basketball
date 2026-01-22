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


const app = express();
app.use(cors());
app.use(express.json());
// --- NBA (isolated) ---
// Separate DB file + separate API prefix so we do NOT touch Polymarket behavior.
const nbaOpened = openNbaDb();
const nbaDb = nbaOpened.db;
app.use("/api/nba", makeNbaRouter(nbaDb, { NBA_DB_PATH: nbaOpened.NBA_DB_PATH }));



// -------------------------
// 1) ALWAYS REGISTER API + HEALTH FIRST (before any static/SPAs)
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

// Mount your existing DB history router (keep this)
try {
  const nbaHistory = require("../server/routes/nbahistory");
  app.use("/api/nba/db", nbaHistory);
} catch (e) {
  console.log("nbaHistory router not loaded:", e?.message || e);
}

// -------------------------
// 2) PLAYERS: IMPORT + SEARCH (DB-backed)
// -------------------------

function bdlHeaders() {
  const key = (process.env.BALLDONTLIE_API_KEY || "").trim();
  if (!key) return {};
  // Some providers use Authorization, some use X-API-Key
  return { Authorization: key, "X-API-Key": key };
}

// One-time import endpoint
app.post("/api/nba/db/players/import", async (req, res) => {
  try {
    const perPage = Math.min(Number(req.body.per_page || 100), 100);
    const maxPages = Math.min(Number(req.body.max_pages || 200), 500);

    const baseUrl = (process.env.BALLDONTLIE_BASE_URL || "https://api.balldontlie.io/v1")
      .replace(/\/+$/, "");

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

// Search players by name
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
// 3) YOUR EXISTING POLYMARKET / SNAPSHOT STUFF (kept minimal)
// -------------------------

console.log("POLYMARKET EXPORTS:", Object.keys(polymarket));
console.log("SERVER.JS STARTED");
console.log("SQLITE PATH:", DB_PATH);

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

// -------------------------
// 4) IMPORTANT: API 404 MUST BE JSON (prevents HTML website fallback on /api/*)
// -------------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found", path: req.originalUrl });
});

// -------------------------
// 5) STATIC + SPA FALLBACK (LAST)
// -------------------------

// Serve built frontend from /public (or any static assets you have there)
app.use(express.static(path.join(__dirname, "public")));

// If you have a single-page app build in /public, this ensures refresh works.
// It will NOT affect /api/* because we handled /api above.
// --- NBA PAGE (must be above SPA fallback) ---

// --- NBA REACT (static build) ---
app.use("/nba", express.static(path.join(__dirname, "nba_public"), { index: "index.html" }));

// Polymarket SPA fallback (unchanged)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// -------------------------
// 6) LISTEN
// -------------------------
const port = Number(process.env.PORT || 3001);
app.listen(port, "0.0.0.0", () => {
  console.log(`API running on http://127.0.0.1:${port}`);
});
