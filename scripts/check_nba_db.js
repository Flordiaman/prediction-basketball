const Database = require("better-sqlite3");
const db = new Database("nba_history.sqlite", { readonly: true });

const counts = {
  teams: db.prepare("SELECT COUNT(*) AS n FROM nba_teams").get().n,
  players: db.prepare("SELECT COUNT(*) AS n FROM nba_players").get().n,
  games: db.prepare("SELECT COUNT(*) AS n FROM nba_games").get().n,
  box_scores: db.prepare("SELECT COUNT(*) AS n FROM nba_player_box_scores").get().n,
  team_totals: db.prepare("SELECT COUNT(*) AS n FROM nba_team_game_totals").get().n,
};

console.log(counts);

// sample: last 5 games by date
const sampleGames = db.prepare(`
  SELECT game_id, game_date, season_year, season_type
  FROM nba_games
  ORDER BY game_date DESC
  LIMIT 5
`).all();

console.log("Sample games:", sampleGames);

db.close();
