const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const schemaPath = path.join(__dirname, "..", "server", "schema_nba.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

const db = new Database("nba_history.sqlite");
db.exec(schema);

console.log("NBA history database created from server/schema_nba.sql");
db.close();

