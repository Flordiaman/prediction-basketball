-- NBA Historical Data (2010–2024) schema for SQLite
-- Uses natural keys from dataset: gameId, teamId, personId

PRAGMA foreign_keys = ON;

-- ---------- Dimensions ----------
CREATE TABLE IF NOT EXISTS nba_teams (
  team_id        INTEGER PRIMARY KEY,   -- teamId
  team_tricode   TEXT,
  team_city      TEXT,
  team_name      TEXT
);

CREATE TABLE IF NOT EXISTS nba_players (
  person_id      INTEGER PRIMARY KEY,   -- personId
  person_name    TEXT
);

CREATE TABLE IF NOT EXISTS nba_games (
  game_id        INTEGER PRIMARY KEY,   -- gameId
  game_date      TEXT NOT NULL,         -- keep as ISO text (YYYY-MM-DD or full timestamp)
  season_year    INTEGER,               -- e.g. 2019, 2020
  season_type    TEXT                   -- 'REG' or 'PLAY' (we’ll populate during import)
);

-- ---------- Facts ----------
-- One row per (game, team, player)
CREATE TABLE IF NOT EXISTS nba_player_box_scores (
  game_id     INTEGER NOT NULL,
  team_id     INTEGER NOT NULL,
  person_id   INTEGER NOT NULL,

  season_year INTEGER,
  game_date   TEXT,
  season_type TEXT,                     -- 'REG' or 'PLAY'

  min         TEXT,                     -- often "mm:ss" in NBA data
  fgm         INTEGER,
  fga         INTEGER,
  fg3m        INTEGER,
  fg3a        INTEGER,
  ftm         INTEGER,
  fta         INTEGER,
  oreb        INTEGER,
  dreb        INTEGER,
  reb         INTEGER,
  ast         INTEGER,
  stl         INTEGER,
  blk         INTEGER,
  tov         INTEGER,
  pf          INTEGER,
  pts         INTEGER,
  plus_minus  REAL,

  PRIMARY KEY (game_id, team_id, person_id),

  FOREIGN KEY (game_id) REFERENCES nba_games(game_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES nba_teams(team_id),
  FOREIGN KEY (person_id) REFERENCES nba_players(person_id)
);

-- One row per (game, team)
CREATE TABLE IF NOT EXISTS nba_team_game_totals (
  game_id     INTEGER NOT NULL,
  team_id     INTEGER NOT NULL,

  season_year INTEGER,
  game_date   TEXT,
  season_type TEXT,                     -- 'REG' or 'PLAY'

  wl          TEXT,                     -- W/L if present
  matchup     TEXT,                     -- e.g. "LAL vs BOS" / "LAL @ BOS" if present

  min         INTEGER,
  fgm         INTEGER,
  fga         INTEGER,
  fg3m        INTEGER,
  fg3a        INTEGER,
  ftm         INTEGER,
  fta         INTEGER,
  oreb        INTEGER,
  dreb        INTEGER,
  reb         INTEGER,
  ast         INTEGER,
  stl         INTEGER,
  blk         INTEGER,
  tov         INTEGER,
  pf          INTEGER,
  pts         INTEGER,
  plus_minus  REAL,

  PRIMARY KEY (game_id, team_id),

  FOREIGN KEY (game_id) REFERENCES nba_games(game_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES nba_teams(team_id)
);

-- ---------- Indexes (speed) ----------
CREATE INDEX IF NOT EXISTS idx_nba_games_date
  ON nba_games(game_date);

CREATE INDEX IF NOT EXISTS idx_nba_pbs_person_season
  ON nba_player_box_scores(person_id, season_year);

CREATE INDEX IF NOT EXISTS idx_nba_pbs_game
  ON nba_player_box_scores(game_id);

CREATE INDEX IF NOT EXISTS idx_nba_tgt_team_season
  ON nba_team_game_totals(team_id, season_year);

CREATE INDEX IF NOT EXISTS idx_nba_tgt_game
  ON nba_team_game_totals(game_id);
