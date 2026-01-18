// src/polymarket.js
const GAMMA_BASE = "https://gamma-api.polymarket.com";

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Gamma ${r.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gamma parse error: ${text}`);
  }
}

function getMarketTypes() {
  return ["moneyline", "spreads", "totals"];
}

// Public-search (kept)
async function searchMarkets(q, limit = 25, page = 1) {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("page", String(page));
  params.set("limit_per_type", String(limit));
  params.set("search_tags", "false");
  params.set("search_profiles", "false");

  const url = `${GAMMA_BASE}/public-search?${params.toString()}`;
  const data = await getJson(url);

  const events = Array.isArray(data?.events) ? data.events : [];
  const hits = [];

  for (const ev of events) {
    const markets = Array.isArray(ev?.markets) ? ev.markets : [];
    for (const m of markets) {
      hits.push({
        kind: "market",
        id: m?.id ?? null,
        slug: m?.slug ?? null,
        question: m?.question ?? m?.title ?? null,
        title: m?.title ?? m?.question ?? null,
        eventId: ev?.id ?? null,
        eventSlug: ev?.slug ?? null,
        eventTitle: ev?.title ?? null,
        eventSubtitle: ev?.subtitle ?? null,
        endDate: m?.endDate ?? ev?.endDate ?? null,
        active: m?.active ?? ev?.active ?? null,
        closed: m?.closed ?? ev?.closed ?? null,
        raw: { event: ev, market: m },
      });
    }
  }

  return {
    q,
    page,
    pages_scanned: 1,
    hits_count: hits.length,
    hits,
    pagination: data?.pagination ?? null,
  };
}

// Markets list
async function listMarkets({ limit = 100, offset = 0, active = true, closed = false } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (active !== undefined) params.set("active", String(active));
  if (closed !== undefined) params.set("closed", String(closed));

  const url = `${GAMMA_BASE}/markets?${params.toString()}`;
  const data = await getJson(url);
  const arr = Array.isArray(data) ? data : [];

  return arr.map((m) => ({
    kind: "market",
    id: m?.id ?? null,
    slug: m?.slug ?? null,
    question: m?.question ?? m?.title ?? null,
    title: m?.title ?? m?.question ?? null,
    endDate: m?.endDate ?? null,
    active: m?.active ?? null,
    closed: m?.closed ?? null,
    sportsMarketType: m?.sportsMarketType ?? null,
    events: m?.events ?? null,
    raw: m,
  }));
}

// Market by slug
async function getMarketBySlug(slug) {
  const url = `${GAMMA_BASE}/markets/slug/${encodeURIComponent(slug)}`;
  const m = await getJson(url);

  return {
    kind: "market",
    id: m?.id ?? null,
    slug: m?.slug ?? slug,
    question: m?.question ?? m?.title ?? null,
    title: m?.title ?? m?.question ?? null,
    endDate: m?.endDate ?? null,
    active: m?.active ?? null,
    closed: m?.closed ?? null,
    sportsMarketType: m?.sportsMarketType ?? null,
    events: m?.events ?? null,
    raw: m,
  };
}

// Events list (NEW)
async function listEvents(paramsObj = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(paramsObj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
    else params.set(k, String(v));
  }

  const url = `${GAMMA_BASE}/events?${params.toString()}`;
  const data = await getJson(url);
  return Array.isArray(data) ? data : [];
}

// Event by slug (NEW)
async function getEventBySlug(slug) {
  const url = `${GAMMA_BASE}/events/slug/${encodeURIComponent(slug)}`;
  return await getJson(url);
}

module.exports = {
  searchMarkets,
  getMarketTypes,
  listMarkets,
  getMarketBySlug,
  listEvents,
  getEventBySlug,
};
