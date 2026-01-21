const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const router = express.Router();

// Read-only DB connection
const dbPath = path.join(__dirname, "..", "..", "nba_history.sqlite");
const db = new Database(dbPath, { readonly: true });

// GET /api/nba/history/games?date=YYYY-MM-DD&season=2024&type=REG|PLAY&limit=50&offset=0
router.get("/games", (req, res) => {
  const { date, season, type, limit = 50, offset = 0 } = req.query;

  const where = [];
  const params = {};

  if (date) { where.push("game_date LIKE @date || '%'"); params.date = date; }
  if (season) { where.push("season_year = @season"); params.season = Number(season); }
  if (type) { where.push("season_type = @type"); params.type = type; }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT game_id, game_date, season_year, season_type
    FROM nba_games
    ${whereSql}
    ORDER BY game_date DESC
    LIMIT @limit OFFSET @offset
  `;

  params.limit = Number(limit);
  params.offset = Number(offset);

  const rows = db.prepare(sql).all(params);
  res.json(rows);
});

// GET /api/nba/history/game/:gameId
router.get("/game/:gameId", (req, res) => {
  const gameId = Number(req.params.gameId);
  const game = db.prepare(`
    SELECT game_id, game_date, season_year, season_type
    FROM nba_games
    WHERE game_id = ?
  `).get(gameId);

  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
});

// GET /api/nba/history/boxscores?gameId=...
router.get("/boxscores", (req, res) => {
  const gameId = Number(req.query.gameId);
  if (!gameId) return res.status(400).json({ error: "gameId required" });

  const rows = db.prepare(`
    SELECT
      p.game_id, p.team_id, t.team_tricode,
      p.person_id, pl.person_name,
      p.min, p.fgm, p.fga, p.fg3m, p.fg3a, p.ftm, p.fta,
      p.reb, p.ast, p.stl, p.blk, p.tov, p.pf, p.pts, p.plus_minus
    FROM nba_player_box_scores p
    LEFT JOIN nba_players pl ON pl.person_id = p.person_id
    LEFT JOIN nba_teams t ON t.team_id = p.team_id
    WHERE p.game_id = ?
    ORDER BY p.team_id, p.pts DESC
  `).all(gameId);

  res.json(rows);
});

// GET /api/nba/history/player/:personId?season=2024&limit=100&offset=0
router.get("/player/:personId", (req, res) => {
  const personId = Number(req.params.personId);
  const { season, limit = 100, offset = 0 } = req.query;

  const params = { personId, limit: Number(limit), offset: Number(offset) };
  const seasonFilter = season ? "AND p.season_year = @season" : "";
  if (season) params.season = Number(season);

  const rows = db.prepare(`
    SELECT
      p.game_id, p.game_date, p.season_year, p.season_type,
      p.team_id, t.team_tricode,
      p.min, p.fgm, p.fga, p.fg3m, p.fg3a, p.ftm, p.fta,
      p.reb, p.ast, p.stl, p.blk, p.tov, p.pf, p.pts, p.plus_minus
    FROM nba_player_box_scores p
    LEFT JOIN nba_teams t ON t.team_id = p.team_id
    WHERE p.person_id = @personId
      ${seasonFilter}
    ORDER BY p.game_date DESC
    LIMIT @limit OFFSET @offset
  `).all(params);

  res.json(rows);
});

// GET /api/nba/history/team/:teamId?season=2024&limit=200&offset=0
router.get("/team/:teamId", (req, res) => {
  const teamId = Number(req.params.teamId);
  const { season, limit = 200, offset = 0 } = req.query;

  const params = { teamId, limit: Number(limit), offset: Number(offset) };
  const seasonFilter = season ? "AND t.season_year = @season" : "";
  if (season) params.season = Number(season);

  const rows = db.prepare(`
    SELECT
      t.game_id, t.game_date, t.season_year, t.season_type,
      t.wl, t.matchup, t.pts, t.reb, t.ast, t.tov, t.plus_minus
    FROM nba_team_game_totals t
    WHERE t.team_id = @teamId
      ${seasonFilter}
    ORDER BY t.game_date DESC
    LIMIT @limit OFFSET @offset
  `).all(params);

  res.json(rows);
});

// GET /api/nba/db/players?q=lebron&limit=20
router.get("/players", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Number(req.query.limit || 20);

  if (!q) return res.json([]);

  const rows = db.prepare(`
    SELECT person_id, person_name
    FROM nba_players
    WHERE lower(person_name) LIKE '%' || ? || '%'
    ORDER BY person_name
    LIMIT ?
  `).all(q, limit);

  res.json(rows);
});
// GET /api/nba/db/players?q=lebron&limit=20
router.get("/players", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Number(req.query.limit || 20);

  if (!q) return res.json([]);

  const rows = db.prepare(`
    SELECT person_id, person_name
    FROM nba_players
    WHERE lower(person_name) LIKE '%' || ? || '%'
    ORDER BY person_name
    LIMIT ?
  `).all(q, limit);

  res.json(rows);
});
// GET /api/nba/db/players?q=lebron&limit=20
router.get("/players", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Number(req.query.limit || 20);

  if (!q) return res.json([]);

  const rows = db.prepare(`
    SELECT person_id, person_name
    FROM nba_players
    WHERE lower(person_name) LIKE '%' || ? || '%'
    ORDER BY person_name
    LIMIT ?
  `).all(q, limit);

  res.json(rows);
});
// GET /api/nba/db/players?q=lebron&limit=20
router.get("/players", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = Number(req.query.limit || 20);

  if (!q) return res.json([]);

  const rows = db.prepare(`
    SELECT person_id, person_name
    FROM nba_players
    WHERE lower(person_name) LIKE '%' || ? || '%'
    ORDER BY person_name
    LIMIT ?
  `).all(q, limit);

  res.json(rows);
});


module.exports = router;
