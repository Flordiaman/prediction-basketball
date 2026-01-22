// E:\prediction_basketball\src\nbaDb.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const NBA_DB_PATH =
  process.env.NBA_DB_PATH || path.join(process.cwd(), "nba.sqlite");

function openNbaDb() {
  const first = !fs.existsSync(NBA_DB_PATH);
  const db = new Database(NBA_DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Schema (NBA-only DB; does not touch polymarket DB)
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      team_id INTEGER PRIMARY KEY,
      abbreviation TEXT NOT NULL,
      full_name TEXT NOT NULL,
      conference TEXT NOT NULL,
      division TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      person_id INTEGER PRIMARY KEY,
      person_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      team_id INTEGER,
      position TEXT,
      height TEXT,
      weight INTEGER,
      birthdate TEXT,
      country TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_players_name ON players(person_name);
    CREATE INDEX IF NOT EXISTS idx_players_last ON players(last_name);
    CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);

    -- One row per game
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      season_year INTEGER,
      game_date TEXT,
      home_team_tricode TEXT,
      away_team_tricode TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
    CREATE INDEX IF NOT EXISTS idx_games_season ON games(season_year);

    -- One row per player per game per team
    CREATE TABLE IF NOT EXISTS box_scores (
      game_id TEXT NOT NULL,
      season_year INTEGER,
      game_date TEXT,

      team_id INTEGER,
      team_tricode TEXT,

      opponent_tricode TEXT,
      is_home INTEGER, -- 1 home, 0 away, NULL unknown

      person_id INTEGER NOT NULL,
      person_name TEXT,

      position TEXT,
      jersey_num TEXT,
      minutes TEXT,
      comment TEXT,

      fgm INTEGER,
      fga INTEGER,
      fg_pct REAL,

      fg3m INTEGER,
      fg3a INTEGER,
      fg3_pct REAL,

      ftm INTEGER,
      fta INTEGER,
      ft_pct REAL,

      oreb INTEGER,
      dreb INTEGER,
      reb INTEGER,

      ast INTEGER,
      stl INTEGER,
      blk INTEGER,

      tov INTEGER,
      pf INTEGER,

      pts INTEGER,
      plus_minus INTEGER,

      PRIMARY KEY (game_id, person_id, team_id)
    );

    CREATE INDEX IF NOT EXISTS idx_box_person ON box_scores(person_id);
    CREATE INDEX IF NOT EXISTS idx_box_team ON box_scores(team_id);
    CREATE INDEX IF NOT EXISTS idx_box_game_date ON box_scores(game_date);
    CREATE INDEX IF NOT EXISTS idx_box_game ON box_scores(game_id);
  `);

  // Seed teams only if empty
  const teamCount = db.prepare(`SELECT COUNT(*) AS n FROM teams`).get().n;
  if (first || teamCount === 0) seedTeams(db);

  return { db, NBA_DB_PATH };
}

function seedTeams(db) {
  const teams = [
    { team_id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks", conference: "East", division: "Southeast" },
    { team_id: 2, abbreviation: "BOS", full_name: "Boston Celtics", conference: "East", division: "Atlantic" },
    { team_id: 3, abbreviation: "BKN", full_name: "Brooklyn Nets", conference: "East", division: "Atlantic" },
    { team_id: 4, abbreviation: "CHA", full_name: "Charlotte Hornets", conference: "East", division: "Southeast" },
    { team_id: 5, abbreviation: "CHI", full_name: "Chicago Bulls", conference: "East", division: "Central" },
    { team_id: 6, abbreviation: "CLE", full_name: "Cleveland Cavaliers", conference: "East", division: "Central" },
    { team_id: 7, abbreviation: "DAL", full_name: "Dallas Mavericks", conference: "West", division: "Southwest" },
    { team_id: 8, abbreviation: "DEN", full_name: "Denver Nuggets", conference: "West", division: "Northwest" },
    { team_id: 9, abbreviation: "DET", full_name: "Detroit Pistons", conference: "East", division: "Central" },
    { team_id: 10, abbreviation: "GSW", full_name: "Golden State Warriors", conference: "West", division: "Pacific" },
    { team_id: 11, abbreviation: "HOU", full_name: "Houston Rockets", conference: "West", division: "Southwest" },
    { team_id: 12, abbreviation: "IND", full_name: "Indiana Pacers", conference: "East", division: "Central" },
    { team_id: 13, abbreviation: "LAC", full_name: "LA Clippers", conference: "West", division: "Pacific" },
    { team_id: 14, abbreviation: "LAL", full_name: "Los Angeles Lakers", conference: "West", division: "Pacific" },
    { team_id: 15, abbreviation: "MEM", full_name: "Memphis Grizzlies", conference: "West", division: "Southwest" },
    { team_id: 16, abbreviation: "MIA", full_name: "Miami Heat", conference: "East", division: "Southeast" },
    { team_id: 17, abbreviation: "MIL", full_name: "Milwaukee Bucks", conference: "East", division: "Central" },
    { team_id: 18, abbreviation: "MIN", full_name: "Minnesota Timberwolves", conference: "West", division: "Northwest" },
    { team_id: 19, abbreviation: "NOP", full_name: "New Orleans Pelicans", conference: "West", division: "Southwest" },
    { team_id: 20, abbreviation: "NYK", full_name: "New York Knicks", conference: "East", division: "Atlantic" },
    { team_id: 21, abbreviation: "OKC", full_name: "Oklahoma City Thunder", conference: "West", division: "Northwest" },
    { team_id: 22, abbreviation: "ORL", full_name: "Orlando Magic", conference: "East", division: "Southeast" },
    { team_id: 23, abbreviation: "PHI", full_name: "Philadelphia 76ers", conference: "East", division: "Atlantic" },
    { team_id: 24, abbreviation: "PHX", full_name: "Phoenix Suns", conference: "West", division: "Pacific" },
    { team_id: 25, abbreviation: "POR", full_name: "Portland Trail Blazers", conference: "West", division: "Northwest" },
    { team_id: 26, abbreviation: "SAC", full_name: "Sacramento Kings", conference: "West", division: "Pacific" },
    { team_id: 27, abbreviation: "SAS", full_name: "San Antonio Spurs", conference: "West", division: "Southwest" },
    { team_id: 28, abbreviation: "TOR", full_name: "Toronto Raptors", conference: "East", division: "Atlantic" },
    { team_id: 29, abbreviation: "UTA", full_name: "Utah Jazz", conference: "West", division: "Northwest" },
    { team_id: 30, abbreviation: "WAS", full_name: "Washington Wizards", conference: "East", division: "Southeast" }
  ];

  const ins = db.prepare(`
    INSERT OR REPLACE INTO teams
    (team_id, abbreviation, full_name, conference, division)
    VALUES (@team_id, @abbreviation, @full_name, @conference, @division)
  `);

  const tx = db.transaction(() => teams.forEach(t => ins.run(t)));
  tx();
}

module.exports = { openNbaDb };
