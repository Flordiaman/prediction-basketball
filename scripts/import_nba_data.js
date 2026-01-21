const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const Database = require("better-sqlite3");

// ---- CONFIG ----
const DB_PATH = path.join(__dirname, "..", "nba_history.sqlite");
const CSV_DIR =
  process.env.NBA_CSV_DIR ||
  path.join(__dirname, "..", "data", "nba-data-2010-2024");

// ---- helpers ----
const pick = (row, ...keys) => keys.map(k => row[k]).find(v => v !== "" && v != null) ?? null;
const toInt = v => (v == null || v === "" ? null : parseInt(v, 10));
const toReal = v => (v == null || v === "" ? null : parseFloat(v));
const seasonTypeFromFilename = f => /play/i.test(f) ? "PLAY" : "REG";
const isBox = f => /box/i.test(f);
const isTotals = f => /total/i.test(f);

// ---- DB ----
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ---- statements ----
const upsertTeam = db.prepare(`
INSERT INTO nba_teams (team_id, team_tricode, team_city, team_name)
VALUES (@team_id, @team_tricode, @team_city, @team_name)
ON CONFLICT(team_id) DO UPDATE SET
 team_tricode=COALESCE(excluded.team_tricode,nba_teams.team_tricode),
 team_city=COALESCE(excluded.team_city,nba_teams.team_city),
 team_name=COALESCE(excluded.team_name,nba_teams.team_name)
`);

const upsertPlayer = db.prepare(`
INSERT INTO nba_players (person_id, person_name)
VALUES (@person_id, @person_name)
ON CONFLICT(person_id) DO UPDATE SET
 person_name=COALESCE(excluded.person_name,nba_players.person_name)
`);

const insertGame = db.prepare(`
INSERT OR IGNORE INTO nba_games (game_id, game_date, season_year, season_type)
VALUES (@game_id, @game_date, @season_year, @season_type)
`);

const upsertBox = db.prepare(`
INSERT INTO nba_player_box_scores (
 game_id,team_id,person_id,season_year,game_date,season_type,
 min,fgm,fga,fg3m,fg3a,ftm,fta,oreb,dreb,reb,ast,stl,blk,tov,pf,pts,plus_minus
) VALUES (
 @game_id,@team_id,@person_id,@season_year,@game_date,@season_type,
 @min,@fgm,@fga,@fg3m,@fg3a,@ftm,@fta,@oreb,@dreb,@reb,@ast,@stl,@blk,@tov,@pf,@pts,@plus_minus
)
ON CONFLICT(game_id,team_id,person_id) DO UPDATE SET
 pts=COALESCE(excluded.pts,nba_player_box_scores.pts)
`);

const upsertTotals = db.prepare(`
INSERT INTO nba_team_game_totals (
 game_id,team_id,season_year,game_date,season_type,
 wl,matchup,min,fgm,fga,fg3m,fg3a,ftm,fta,oreb,dreb,reb,ast,stl,blk,tov,pf,pts,plus_minus
) VALUES (
 @game_id,@team_id,@season_year,@game_date,@season_type,
 @wl,@matchup,@min,@fgm,@fga,@fg3m,@fg3a,@ftm,@fta,@oreb,@dreb,@reb,@ast,@stl,@blk,@tov,@pf,@pts,@plus_minus
)
ON CONFLICT(game_id,team_id) DO UPDATE SET
 pts=COALESCE(excluded.pts,nba_team_game_totals.pts)
`);

// ---- import ----
function importFile(file) {
  const season_type = seasonTypeFromFilename(file);
  const mode = isBox(file) ? "BOX" : isTotals(file) ? "TOTALS" : null;
  if (!mode) return;

  console.log("Importing:", file);
  let batch = [];
  const BATCH = 3000;

  const runBatch = db.transaction(rows => {
    for (const r of rows) {
      const game_id = toInt(pick(r,"gameId","GAME_ID"));
      const team_id = toInt(pick(r,"teamId","TEAM_ID"));
      const person_id = toInt(pick(r,"personId","PERSON_ID"));
      const game_date = pick(r,"gameDate","GAME_DATE","GAME_DATE_EST") || "1900-01-01";
      const season_year = toInt(pick(r,"seasonYear","SEASON_YEAR"));

      if (!game_id || !team_id) continue;

      upsertTeam.run({
        team_id,
        team_tricode: pick(r,"teamTricode","TEAM_ABBREVIATION"),
        team_city: pick(r,"teamCity","TEAM_CITY"),
        team_name: pick(r,"teamName","TEAM_NAME")
      });

      if (person_id) {
        upsertPlayer.run({
          person_id,
          person_name: pick(r,"personName","PLAYER_NAME")
        });
      }

      insertGame.run({ game_id, game_date, season_year, season_type });

      if (mode==="BOX" && person_id) {
        upsertBox.run({
          game_id,team_id,person_id,season_year,game_date,season_type,
          min: pick(r,"min","MIN"),
          fgm: toInt(pick(r,"fgm","FGM")),
          fga: toInt(pick(r,"fga","FGA")),
          fg3m: toInt(pick(r,"fg3m","FG3M")),
          fg3a: toInt(pick(r,"fg3a","FG3A")),
          ftm: toInt(pick(r,"ftm","FTM")),
          fta: toInt(pick(r,"fta","FTA")),
          oreb: toInt(pick(r,"oreb","OREB")),
          dreb: toInt(pick(r,"dreb","DREB")),
          reb: toInt(pick(r,"reb","REB")),
          ast: toInt(pick(r,"ast","AST")),
          stl: toInt(pick(r,"stl","STL")),
          blk: toInt(pick(r,"blk","BLK")),
          tov: toInt(pick(r,"tov","TOV","TO")),
          pf: toInt(pick(r,"pf","PF")),
          pts: toInt(pick(r,"pts","PTS")),
          plus_minus: toReal(pick(r,"plusMinus","PLUS_MINUS"))
        });
      }

      if (mode==="TOTALS") {
        upsertTotals.run({
          game_id,team_id,season_year,game_date,season_type,
          wl: pick(r,"wl","WL"),
          matchup: pick(r,"matchup","MATCHUP"),
          min: toInt(pick(r,"min","MIN")),
          fgm: toInt(pick(r,"fgm","FGM")),
          fga: toInt(pick(r,"fga","FGA")),
          fg3m: toInt(pick(r,"fg3m","FG3M")),
          fg3a: toInt(pick(r,"fg3a","FG3A")),
          ftm: toInt(pick(r,"ftm","FTM")),
          fta: toInt(pick(r,"fta","FTA")),
          oreb: toInt(pick(r,"oreb","OREB")),
          dreb: toInt(pick(r,"dreb","DREB")),
          reb: toInt(pick(r,"reb","REB")),
          ast: toInt(pick(r,"ast","AST")),
          stl: toInt(pick(r,"stl","STL")),
          blk: toInt(pick(r,"blk","BLK")),
          tov: toInt(pick(r,"tov","TOV","TO")),
          pf: toInt(pick(r,"pf","PF")),
          pts: toInt(pick(r,"pts","PTS")),
          plus_minus: toReal(pick(r,"plusMinus","PLUS_MINUS"))
        });
      }
    }
  });

  return new Promise(res=>{
    fs.createReadStream(path.join(CSV_DIR,file))
      .pipe(csv())
      .on("data", r=>{
        batch.push(r);
        if(batch.length>=BATCH){ runBatch(batch); batch=[]; }
      })
      .on("end", ()=>{
        if(batch.length) runBatch(batch);
        console.log("Done:", file);
        res();
      });
  });
}

// ---- run ----
(async ()=>{
  const files = fs.readdirSync(CSV_DIR).filter(f=>f.endsWith(".csv"));
  for(const f of files) await importFile(f);
  console.log("Import complete");
  db.close();
})();
