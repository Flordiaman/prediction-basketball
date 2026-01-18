const Database = require("better-sqlite3");
const fs = require("fs");

const db = new Database("predictions.db");

function init() {
  const schema = fs.readFileSync("./schema.sql", "utf8");
  db.exec(schema);
}

module.exports = { db, init };
