const BASE_URL =
  process.env.KALSHI_BASE_URL || "https://api.elections.kalshi.com/trade-api/v2";

async function kalshiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kalshi error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getSeriesList({ category, tags, limit = 200, cursor } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (tags) params.set("tags", tags);
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const q = params.toString() ? `?${params}` : "";
  return kalshiGet(`/series${q}`);
}

async function getMarkets({ series_ticker, event_ticker, status, limit = 200, cursor } = {}) {
  const params = new URLSearchParams();
  if (series_ticker) params.set("series_ticker", series_ticker);
  if (event_ticker) params.set("event_ticker", event_ticker);
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const q = params.toString();
  return kalshiGet(`/markets?${q}`);
}

module.exports = { getSeriesList, getMarkets };

