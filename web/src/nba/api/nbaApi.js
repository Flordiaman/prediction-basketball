const API_BASE = import.meta.env.VITE_API_BASE || "";

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

export async function fetchStatus() {
  return getJson("/api/status");
}

export async function fetchGames(dateStr) {
  const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  return getJson(`/api/nba/games${q}`);
}

export async function fetchPlayers(search) {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return getJson(`/api/nba/players${q}`);
}

export async function fetchTeams() {
  return getJson(`/api/nba/teams`);
}

export async function fetchPicks(dateStr) {
  const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  return getJson(`/api/nba/picks${q}`);
}
