// scripts/ingest_today_team_games.js
require("dotenv").config({ path: "E:/prediction_basketball/.env" });
const Database = require("better-sqlite3");

const DB_PATH = "E:/prediction_basketball/nba_history.sqlite";

// Try common env var names without guessing which one you used
const API_KEY =
  process.env.BALLDONTLIE_API_KEY ||
  process.env.BDL_API_KEY ||
  process.env.BALLDONTLIE_KEY;

if (!API_KEY) {
  console.error("Missing BallDontLie API key in .env");
  process.exit(1);
}

function todayNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

async function main() {
  const dateStr = todayNY();
  const url = `https://api.balldontlie.io/v1/games?dates[]=${dateStr}&per_page=100`;

  const res = await fetch(url, {
    headers: { Authorization: API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BallDontLie ${res.status}: ${text}`);
  }

  const json = await res.json();
  const games = json.data || [];

  const db = new Database(DB_PATH);

  const ins = db.prepare(`
    INSERT INTO team_games
      (game_id, game_date, season, team_id, opponent_team_id, home_away, team_score, opp_score, win)
    VALUES
      (@game_id, @game_date, @season, @team_id, @opponent_team_id, @home_away, @team_score, @opp_score, @win)
    ON CONFLICT(game_id, team_id) DO UPDATE SET
      team_score=excluded.team_score,
      opp_score=excluded.opp_score,
      win=excluded.win
  `);

  const tx = db.transaction((rows) => rows.forEach((r) => ins.run(r)));

  const rows = [];
  for (const g of games) {
    const game_id = g.id;
    const season = g.season ?? null;

    const homeId = g.home_team?.id;
    const awayId = g.visitor_team?.id;

    const homeScore = g.home_team_score;
    const awayScore = g.visitor_team_score;

    const played = Number.isFinite(homeScore) && Number.isFinite(awayScore);
    const homeWin = played ? (homeScore > awayScore ? 1 : 0) : null;
    const awayWin = played ? (awayScore > homeScore ? 1 : 0) : null;

    if (!homeId || !awayId) continue;

    rows.push({
      game_id,
      game_date: dateStr,
      season,
      team_id: homeId,
      opponent_team_id: awayId,
      home_away: "H",
      team_score: played ? homeScore : null,
      opp_score: played ? awayScore : null,
      win: homeWin,
    });

    rows.push({
      game_id,
      game_date: dateStr,
      season,
      team_id: awayId,
      opponent_team_id: homeId,
      home_away: "A",
      team_score: played ? awayScore : null,
      opp_score: played ? homeScore : null,
      win: awayWin,
    });
  }

  tx(rows);

  const n = db
    .prepare(`SELECT COUNT(*) AS n FROM team_games WHERE game_date = ?`)
    .get(dateStr).n;

  console.log(`team_games upserted: ${rows.length}. Total rows for ${dateStr}: ${n}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
