/* ===============================
   server/index.js
   CLEAN – Express 5 safe
   =============================== */

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3001;

/* ===============================
   DATABASE
   =============================== */
const db = new Database("nba_history.sqlite");

/* ===============================
   MIDDLEWARE
   =============================== */
app.use(express.json());

/* ===============================
   HELPERS
   =============================== */
function todayNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function getTodayTeamGames(today) {
  const rows = db
    .prepare(`
      SELECT *
      FROM team_games
      WHERE game_date = ?
      ORDER BY game_id
    `)
    .all(today);

  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.game_id]) grouped[r.game_id] = [];
    grouped[r.game_id].push(r);
  }

  return Object.values(grouped).filter((g) => g.length === 2);
}

/* ===============================
   API ROUTES (ALWAYS FIRST)
   =============================== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/predict_today", (req, res) => {
  try {
    const today = todayNY();
    const games = getTodayTeamGames(today);

    res.json({
      date: today,
      count: games.length,
      games: games.map(([a, b]) => ({
        game_id: a.game_id,
        home: a.home_away === "H" ? a : b,
        away: a.home_away === "A" ? a : b,
        source: "team_games",
      })),
    });
  } catch (err) {
    console.error("predict_today error:", err);
    res.status(500).json({ error: "predict_today failed" });
  }
});

/* ===============================
   STATIC FRONTEND + SPA FALLBACK
   EXPRESS 5 SAFE (NO WILDCARDS)
   =============================== */
const webDir = path.join(__dirname, "..", "web", "dist");

// Serve JS/CSS/assets
app.use(express.static(webDir));

// React Router fallback
app.use((req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

/* ===============================
   START SERVER
   =============================== */
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});
