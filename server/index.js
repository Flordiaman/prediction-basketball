/* ===============================
   server/index.js
   CLEAN – API first, SPA last
   =============================== */

const path = require("path");
const fs = require("fs");
const express = require("express");

require("dotenv").config({ path: path.join(process.cwd(), ".env") });

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// -------------------------------
// API routes (FIRST)
// -------------------------------
const nbaHistoryRouter = require("./routes/nbahistory");

// Mount it under /api (and also /api/nba/history for clarity)

app.use("/api/nba", nbaHistoryRouter);
app.use("/api/nba/history", nbaHistoryRouter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Aliases to keep your front-end stable
app.get("/api/nba/db/players/search", (req, res) => {
  // forward to your existing players endpoint
  // NOTE: adjust query param names if your /players expects different ones
  req.url = "/players";
  return nbaHistoryRouter(req, res, () => res.status(404).json({ ok: false, error: "No handler" }));
});

app.get("/api/nba/core/_debug/tables", (req, res) => {
  // We'll implement this properly in nbahistory.js once we see DB path
  res.json({ ok: true, note: "debug endpoint not implemented yet" });
});


// -------------------------------
// Static + SPA (LAST)
// -------------------------------
const WEB_DIST = path.join(process.cwd(), "web", "dist");
const INDEX_HTML = path.join(WEB_DIST, "index.html");

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));

  // SPA fallback: anything except /api/*
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(INDEX_HTML);
  });
}

// 404 for unknown API routes (keeps API from returning HTML)
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ ok: false, error: "Server Error", message: err?.message || String(err) });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BLURIFT server listening on http://localhost:${PORT}`);
  console.log(`Router: server/routes/nbahistory.js mounted at /api and /api/nba/history`);
});
