// src/polymarket.js
const fetch = global.fetch || require("node-fetch");

const GAMMA_BASE = "https://gamma-api.polymarket.com"; // :contentReference[oaicite:1]{index=1}
const CLOB_BASE = "https://clob.polymarket.com";       // :contentReference[oaicite:2]{index=2}

async function gammaGet(path) {
  const res = await fetch(`${GAMMA_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Gamma error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Sports market types (used for filtering sports markets) :contentReference[oaicite:3]{index=3}
async function getSportsMarketTypes() {
  return gammaGet(`/sports/market-types`);
}

// List markets with filters (active/closed/etc) :contentReference[oaicite:4]{index=4}
async function getMarkets(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, String(item));
    } else {
      sp.set(k, String(v));
    }
  }
  return gammaGet(`/markets?${sp.toString()}`);
}

// CLOB orderbook summary :contentReference[oaicite:5]{index=5}
async function clobBook(token_id) {
  const url = `${CLOB_BASE}/book?token_id=${encodeURIComponent(token_id)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CLOB book error ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = { getSportsMarketTypes, getMarkets, clobBook };

