// src/nbaRouter.js
const express = require("express");

/**
 * makeNbaRouter(db, opts)
 * - db: better-sqlite3 Database instance
 * - opts: { NBA_DB_PATH?: string }
 */
function makeNbaRouter(db, opts = {}) {
  const router = express.Router();

  // ----------------------------
  // Helpers
  // ----------------------------
  function intOr(v, def) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  function tableExists(name) {
    try {
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(name);
      return !!row;
    } catch {
      return false;
    }
  }

  function tableCols(table) {
    try {
      return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
    } catch {
      return [];
    }
  }

  function pickCol(cols, candidates) {
    return candidates.find((c) => cols.includes(c)) || null;
  }

  // ----------------------------
  // Auto-detect stats schema (box_scores)
  // ----------------------------
  const hasPlayers = tableExists("players");
  const hasBoxScores = tableExists("box_scores");

  const boxCols = hasBoxScores ? tableCols("box_scores") : [];

  const boxPlayerIdCol = pickCol(boxCols, ["person_id", "player_id"]);
  const boxGameIdCol = pickCol(boxCols, ["game_id", "gameId"]);
  const boxDateCol = pickCol(boxCols, ["game_date", "game_datetime", "date", "game_time"]);

  const boxPtsCol = pickCol(boxCols, ["pts", "points"]);
  const boxRebCol = pickCol(boxCols, ["reb", "rebounds", "trb"]);
  const boxAstCol = pickCol(boxCols, ["ast", "assists"]);

  const boxMinCol = pickCol(boxCols, ["min", "minutes"]);
  const boxFgmCol = pickCol(boxCols, ["fgm"]);
  const boxFgaCol = pickCol(boxCols, ["fga"]);
  const boxTpmCol = pickCol(boxCols, ["tpm", "fg3m", "three_pm"]);
  const boxTpaCol = pickCol(boxCols, ["tpa", "fg3a", "three_pa"]);
  const boxFtmCol = pickCol(boxCols, ["ftm"]);
  const boxFtaCol = pickCol(boxCols, ["fta"]);
  const boxStlCol = pickCol(boxCols, ["stl", "steals"]);
  const boxBlkCol = pickCol(boxCols, ["blk", "blocks"]);
  const boxTovCol = pickCol(boxCols, ["tov", "turnovers"]);
  const boxPfCol = pickCol(boxCols, ["pf", "fouls"]);

  const boxUsableForAverages =
    hasBoxScores && boxPlayerIdCol && (boxPtsCol || boxRebCol || boxAstCol);

  // ----------------------------
  // Routes
  // ----------------------------

  // Health
  router.get("/health", (req, res) => {
    res.json({ ok: true, area: "nba", time: new Date().toISOString() });
  });

  // Info (useful for debugging / confirming schema)
  router.get("/info", (req, res) => {
    res.json({
      ok: true,
      NBA_DB_PATH: opts.NBA_DB_PATH || null,
      tables: {
        players: hasPlayers,
        box_scores: hasBoxScores,
      },
      box_scores_detected: hasBoxScores
        ? {
            playerId: boxPlayerIdCol,
            gameId: boxGameIdCol,
            date: boxDateCol,
            pts: boxPtsCol,
            reb: boxRebCol,
            ast: boxAstCol,
          }
        : null,
    });
  });

  /**
   * Player search (returns names + optional averages)
   * GET /api/nba/players/search?q=lebron&limit=25
   */
  router.get("/players/search", (req, res) => {
    if (!hasPlayers) return res.json([]);

    const qRaw = (req.query.q || "").toString().trim();
    const limit = Math.min(intOr(req.query.limit, 25), 100);

    if (!qRaw || qRaw.length < 2) return res.json([]);

    const q = qRaw.toLowerCase();
    const exact = q;
    const prefix = q + "%";
    const contains = "%" + q + "%";

    // Base fields always returned
    // If box_scores is usable, also return gp/ppg/rpg/apg from aggregated box_scores
    let sql;
    if (!boxUsableForAverages) {
      sql = `
        SELECT person_id, person_name, position, team_id
        FROM players
        WHERE lower(person_name) LIKE @contains
        ORDER BY
          CASE
            WHEN lower(person_name) = @exact THEN 0
            WHEN lower(person_name) LIKE @prefix THEN 1
            ELSE 2
          END,
          person_name ASC
        LIMIT @limit
      `;
    } else {
      const avgPts = boxPtsCol ? `AVG(${boxPtsCol})` : `NULL`;
      const avgReb = boxRebCol ? `AVG(${boxRebCol})` : `NULL`;
      const avgAst = boxAstCol ? `AVG(${boxAstCol})` : `NULL`;

      sql = `
        SELECT
          p.person_id,
          p.person_name,
          p.position,
          p.team_id,
          s.gp,
          ROUND(s._ppg, 1) AS ppg,
          ROUND(s._rpg, 1) AS rpg,
          ROUND(s._apg, 1) AS apg
        FROM players p
        LEFT JOIN (
          SELECT
            ${boxPlayerIdCol} AS person_id,
            COUNT(*) AS gp,
            (${avgPts}) AS _ppg,
            (${avgReb}) AS _rpg,
            (${avgAst}) AS _apg
          FROM box_scores
          GROUP BY ${boxPlayerIdCol}
        ) s ON s.person_id = p.person_id
        WHERE lower(p.person_name) LIKE @contains
        ORDER BY
          CASE
            WHEN lower(p.person_name) = @exact THEN 0
            WHEN lower(p.person_name) LIKE @prefix THEN 1
            ELSE 2
          END,
          p.person_name ASC
        LIMIT @limit
      `;
    }

    const rows = db.prepare(sql).all({ exact, prefix, contains, limit });
    res.json(rows);
  });

  /**
   * Player summary (identity + averages + most recent game)
   * GET /api/nba/players/:id/summary
   */
  router.get("/players/:id/summary", (req, res) => {
    if (!hasPlayers) return res.status(500).json({ error: "players table missing" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    const player = db
      .prepare(`SELECT person_id, person_name, position, team_id FROM players WHERE person_id = ?`)
      .get(id);

    if (!player) return res.status(404).json({ error: "player not found" });

    let averages = null;
    let lastGame = null;

    if (boxUsableForAverages) {
      const ptsExpr = boxPtsCol ? `ROUND(AVG(${boxPtsCol}), 1) AS ppg` : `NULL AS ppg`;
      const rebExpr = boxRebCol ? `ROUND(AVG(${boxRebCol}), 1) AS rpg` : `NULL AS rpg`;
      const astExpr = boxAstCol ? `ROUND(AVG(${boxAstCol}), 1) AS apg` : `NULL AS apg`;

      averages = db
        .prepare(
          `
        SELECT
          COUNT(*) AS gp,
          ${ptsExpr},
          ${rebExpr},
          ${astExpr}
        FROM box_scores
        WHERE ${boxPlayerIdCol} = ?
      `
        )
        .get(id);

      if (boxDateCol) {
        const cols = [
          boxGameIdCol ? `${boxGameIdCol} AS game_id` : null,
          `${boxDateCol} AS game_date`,
          boxMinCol ? `${boxMinCol} AS min` : null,
          boxPtsCol ? `${boxPtsCol} AS pts` : null,
          boxRebCol ? `${boxRebCol} AS reb` : null,
          boxAstCol ? `${boxAstCol} AS ast` : null,
          boxFgmCol ? `${boxFgmCol} AS fgm` : null,
          boxFgaCol ? `${boxFgaCol} AS fga` : null,
          boxTpmCol ? `${boxTpmCol} AS tpm` : null,
          boxTpaCol ? `${boxTpaCol} AS tpa` : null,
          boxFtmCol ? `${boxFtmCol} AS ftm` : null,
          boxFtaCol ? `${boxFtaCol} AS fta` : null,
          boxStlCol ? `${boxStlCol} AS stl` : null,
          boxBlkCol ? `${boxBlkCol} AS blk` : null,
          boxTovCol ? `${boxTovCol} AS tov` : null,
          boxPfCol ? `${boxPfCol} AS pf` : null,
        ].filter(Boolean);

        lastGame = db
          .prepare(
            `
          SELECT ${cols.join(", ")}
          FROM box_scores
          WHERE ${boxPlayerIdCol} = ?
          ORDER BY ${boxDateCol} DESC
          LIMIT 1
        `
          )
          .get(id);
      }
    }

    res.json({ player, averages, lastGame });
  });

  /**
   * Player boxscores (last N rows)
   * GET /api/nba/players/:id/boxscores?limit=10
   */
  router.get("/players/:id/boxscores", (req, res) => {
    if (!hasBoxScores || !boxPlayerIdCol) return res.json([]);

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    const limit = Math.min(intOr(req.query.limit, 10), 100);

    // return full rows (simple + useful)
    const orderCol = boxDateCol || boxGameIdCol || boxPlayerIdCol;

    const rows = db
      .prepare(
        `
      SELECT *
      FROM box_scores
      WHERE ${boxPlayerIdCol} = ?
      ORDER BY ${orderCol} DESC
      LIMIT ?
    `
      )
      .all(id, limit);

    res.json(rows);
  });

  /**
   * Games (optional) — returns [] if you don’t have a games table
   * GET /api/nba/games?limit=25
   */
  router.get("/games", (req, res) => {
    const limit = Math.min(intOr(req.query.limit, 25), 100);

    if (!tableExists("games")) return res.json([]);

    // minimal safe list (adapt if your schema differs)
    const gameCols = tableCols("games");
    const idCol = pickCol(gameCols, ["game_id", "id"]);
    const dateCol = pickCol(gameCols, ["game_date", "date", "game_datetime"]);

    const selectCols = [
      idCol ? `${idCol} AS game_id` : null,
      dateCol ? `${dateCol} AS game_date` : null,
    ].filter(Boolean);

    const orderCol = dateCol || idCol || "rowid";

    const rows = db
      .prepare(
        `
      SELECT ${selectCols.length ? selectCols.join(", ") : "*"}
      FROM games
      ORDER BY ${orderCol} DESC
      LIMIT ?
    `
      )
      .all(limit);

    res.json(rows);
  });

  return router;
}

module.exports = makeNbaRouter;
