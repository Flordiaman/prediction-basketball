const Database = require("better-sqlite3");
const db = new Database("nba_history.sqlite");

db.exec(`
  -- If games have placeholder date, overwrite it from boxscores/totals where available
  UPDATE nba_games
  SET game_date = COALESCE(
    (SELECT p.game_date FROM nba_player_box_scores p
     WHERE p.game_id = nba_games.game_id
       AND p.game_date IS NOT NULL
       AND p.game_date <> '1900-01-01'
     LIMIT 1),
    (SELECT t.game_date FROM nba_team_game_totals t
     WHERE t.game_id = nba_games.game_id
       AND t.game_date IS NOT NULL
       AND t.game_date <> '1900-01-01'
     LIMIT 1),
    game_date
  )
  WHERE game_date = '1900-01-01';

  UPDATE nba_games
  SET season_year = COALESCE(
    (SELECT p.season_year FROM nba_player_box_scores p
     WHERE p.game_id = nba_games.game_id
       AND p.season_year IS NOT NULL
     LIMIT 1),
    (SELECT t.season_year FROM nba_team_game_totals t
     WHERE t.game_id = nba_games.game_id
       AND t.season_year IS NOT NULL
     LIMIT 1),
    season_year
  )
  WHERE season_year IS NULL;
`);

const remaining = db.prepare(`
  SELECT COUNT(*) AS n
  FROM nba_games
  WHERE game_date = '1900-01-01' OR season_year IS NULL
`).get().n;

const sample = db.prepare(`
  SELECT game_id, game_date, season_year, season_type
  FROM nba_games
  ORDER BY game_date DESC
  LIMIT 10
`).all();

console.log({ remaining_bad_games: remaining });
console.log("Sample games:", sample);

db.close();
