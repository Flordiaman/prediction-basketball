const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const router = express.Router();

// Read-only DB connection
const dbPath = path.join(__dirname, "..", "..", "nba_history.sqlite");
const db = new Database(dbPath, { readonly: true });

/**
 * Helpers
 */
function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// -----------------------------
// HISTORY ENDPOINTS
// -----------------------------

// GET /api/nba/history/games?date=YYYY-MM-DD&season=2024&type=REG|PLAY&limit=50&offset=0
router.get("/games", (req, res) => {
  const { date, season, type } = req.query;
  const limit = toInt(req.query.limit, 50);
  const offset = toInt(req.query.offset, 0);

  const where = [];
  const params = { limit, offset };

  if (date) {
    where.push("game_date LIKE @date || '%'");
    params.date = String(date);
  }
  if (season) {
    where.push("season_year = @season");
    params.season = toInt(season, null);
  }
  if (type) {
    where.push("season_type = @type");
    params.type = String(type);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `
      SELECT game_id, game_date, season_year, season_type
      FROM nba_games
      ${whereSql}
      ORDER BY game_date DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params);

  res.json(rows);
});

// GET /api/nba/history/game/:gameId
router.get("/game/:gameId", (req, res) => {
  const gameId = toInt(req.params.gameId, NaN);
  if (!Number.isFinite(gameId)) return res.status(400).json({ error: "Invalid gameId" });

  const game = db
    .prepare(
      `
      SELECT game_id, game_date, season_year, season_type
      FROM nba_games
      WHERE game_id = ?
    `
    )
    .get(gameId);

  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
});

// GET /api/nba/history/boxscores?gameId=...
router.get("/boxscores", (req, res) => {
  const gameId = toInt(req.query.gameId, NaN);
  if (!Number.isFinite(gameId)) return res.status(400).json({ error: "gameId required" });

  const rows = db
    .prepare(
      `
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
    `
    )
    .all(gameId);

  res.json(rows);
});

// GET /api/nba/history/player/:personId?season=2024&limit=100&offset=0
router.get("/player/:personId", (req, res) => {
  const personId = toInt(req.params.personId, NaN);
  if (!Number.isFinite(personId)) return res.status(400).json({ error: "Invalid personId" });

  const season = req.query.season ? toInt(req.query.season, null) : null;
  const limit = toInt(req.query.limit, 100);
  const offset = toInt(req.query.offset, 0);

  const params = { personId, limit, offset };
  const seasonFilter = season ? "AND p.season_year = @season" : "";
  if (season) params.season = season;

  const rows = db
    .prepare(
      `
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
    `
    )
    .all(params);

  res.json(rows);
});

// GET /api/nba/history/team/:teamId?season=2024&limit=200&offset=0
router.get("/team/:teamId", (req, res) => {
  const teamId = toInt(req.params.teamId, NaN);
  if (!Number.isFinite(teamId)) return res.status(400).json({ error: "Invalid teamId" });

  const season = req.query.season ? toInt(req.query.season, null) : null;
  const limit = toInt(req.query.limit, 200);
  const offset = toInt(req.query.offset, 0);

  const params = { teamId, limit, offset };
  const seasonFilter = season ? "AND t.season_year = @season" : "";
  if (season) params.season = season;

  const rows = db
    .prepare(
      `
      SELECT
        t.game_id, t.game_date, t.season_year, t.season_type,
        t.wl, t.matchup, t.pts, t.reb, t.ast, t.tov, t.plus_minus
      FROM nba_team_game_totals t
      WHERE t.team_id = @teamId
        ${seasonFilter}
      ORDER BY t.game_date DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params);

  res.json(rows);
});

// -----------------------------
// PLAYER SEARCH (existing + alias)
// -----------------------------

// GET /api/nba/history/players?q=lebron&limit=20
router.get("/players", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = toInt(req.query.limit, 20);

  if (!q) return res.json([]);

  const rows = db
    .prepare(
      `
      SELECT person_id, person_name
      FROM nba_players
      WHERE lower(person_name) LIKE '%' || ? || '%'
      ORDER BY person_name
      LIMIT ?
    `
    )
    .all(q, limit);

  res.json(rows);
});

// ✅ Alias: GET /api/nba/db/players/search?q=le&limit=5
router.get("/db/players/search", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = toInt(req.query.limit, 20);

  if (!q) return res.json([]);

  const rows = db
    .prepare(
      `
      SELECT person_id, person_name
      FROM nba_players
      WHERE lower(person_name) LIKE '%' || ? || '%'
      ORDER BY person_name
      LIMIT ?
    `
    )
    .all(q, limit);

  res.json(rows);
});

// ✅ Debug: GET /api/nba/core/_debug/tables
router.get("/core/_debug/tables", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `
    )
    .all();

  res.json({ ok: true, tables: rows.map((r) => r.name) });
});

module.exports = router;
