const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- BUILD STAMP ---------- */
app.get("/api/_build", (req, res) => {
  res.json({ build: "2026-01-21-0305", ok: true });
});

/* ---------- NBA HISTORY ROUTES ---------- */
const nbaHistory = require("./routes/nbahistory");
app.use("/api/nba/history", nbaHistory);

/* ---------- DATABASE ---------- */
const db = new Database("nba_history.sqlite");

/* ---------- HEALTH ---------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS health_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

app.get("/api/health", (req, res) => {
  const row = db.prepare("SELECT datetime('now') as now").get();
  db.prepare("INSERT INTO health_log (message) VALUES (?)").run("health check");
  res.json({ ok: true, serverTime: row.now });
});

/* ---------- TEAMS ---------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    abbr TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    conference TEXT NOT NULL
  );
`);

const teamCount = db.prepare("SELECT COUNT(*) as c FROM teams").get().c;
if (teamCount === 0) {
  const insert = db.prepare(
    "INSERT INTO teams (abbr, name, city, conference) VALUES (?, ?, ?, ?)"
  );

  const teams = [
    ["ATL","Hawks","Atlanta","East"],["BOS","Celtics","Boston","East"],
    ["BKN","Nets","Brooklyn","East"],["CHA","Hornets","Charlotte","East"],
    ["CHI","Bulls","Chicago","East"],["CLE","Cavaliers","Cleveland","East"],
    ["DET","Pistons","Detroit","East"],["IND","Pacers","Indiana","East"],
    ["MIA","Heat","Miami","East"],["MIL","Bucks","Milwaukee","East"],
    ["NYK","Knicks","New York","East"],["ORL","Magic","Orlando","East"],
    ["PHI","76ers","Philadelphia","East"],["TOR","Raptors","Toronto","East"],
    ["WAS","Wizards","Washington","East"],
    ["DAL","Mavericks","Dallas","West"],["DEN","Nuggets","Denver","West"],
    ["GSW","Warriors","Golden State","West"],["HOU","Rockets","Houston","West"],
    ["LAC","Clippers","LA","West"],["LAL","Lakers","LA","West"],
    ["MEM","Grizzlies","Memphis","West"],["MIN","Timberwolves","Minnesota","West"],
    ["NOP","Pelicans","New Orleans","West"],["OKC","Thunder","Oklahoma City","West"],
    ["PHX","Suns","Phoenix","West"],["POR","Trail Blazers","Portland","West"],
    ["SAC","Kings","Sacramento","West"],["SAS","Spurs","San Antonio","West"],
    ["UTA","Jazz","Utah","West"],
  ];

  const tx = db.transaction(() => {
    for (const t of teams) insert.run(...t);
  });
  tx();
}

app.get("/api/teams", (req, res) => {
  const teams = db
    .prepare("SELECT abbr, name, city, conference FROM teams ORDER BY conference, city")
    .all();
  res.json({ teams });
});

/* ---------- LIVE / TODAY GAMES ---------- */
app.get("/api/games/live", async (req, res) => {
  try {
    const r = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
    );
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch ESPN data" });
  }
});

app.get("/api/games/today", async (req, res) => {
  try {
    const apiKey = process.env.BALLDONTLIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing BALLDONTLIE_API_KEY" });

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    const url = `https://api.balldontlie.io/v1/games?dates[]=${today}&per_page=100`;

    const r = await fetch(url, { headers: { Authorization: apiKey } });
    const text = await r.text();

    if (!r.headers.get("content-type")?.includes("application/json")) {
      return res.status(500).json({
        error: "Expected JSON but got something else",
        status: r.status,
        bodyStart: text.slice(0, 200),
      });
    }

    const data = JSON.parse(text);
    const games = (data.data || []).map((g) => ({
      id: g.id,
      status: g.status,
      home: `${g.home_team.abbreviation} ${g.home_team_score}`,
      away: `${g.visitor_team.abbreviation} ${g.visitor_team_score}`,
    }));

    res.json({ date: today, count: games.length, games });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ---------- NBA DB DEBUG ---------- */
// ...other API routes above...

app.get("/api/nba/db/_tables", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
      .all();
    res.json(rows.map((r) => r.name));
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
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

    const rows = db.prepare(sql).all(`%${q}%`, `%${q}%`, `%${q}%`, limit);
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// keep this last:
const webDist = path.join(__dirname, "../web/dist");
console.log("Serving web from:", webDist);
app.use(express.static(webDist));

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(webDist, "index.html"));
});

app.use((err, req, res, next) => {
  console.error("UNHANDLED:", err);
  res.status(500).json({ error: err.message || String(err) });
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
