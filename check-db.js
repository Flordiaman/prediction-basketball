const Database = require("better-sqlite3");
const db = new Database("nba_history.sqlite");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(tables);
