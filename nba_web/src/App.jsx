import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "/api/nba";

function fmtHomeAway(is_home) {
  if (is_home === 1) return "HOME";
  if (is_home === 0) return "AWAY";
  return "";
}

function safe(v) {
  return v === null || v === undefined ? "" : String(v);
}

export default function App() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [selected, setSelected] = useState(null);
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const canSearch = q.trim().length >= 2;

  async function doSearch() {
    const query = q.trim();
    if (query.length < 2) return;

    setLoadingSearch(true);
    setSelected(null);
    setGames([]);

    try {
      const url = `${API_BASE}/players/search?q=${encodeURIComponent(query)}&limit=25`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function loadPlayer(person_id, person_name) {
    setSelected({ person_id, person_name });
    setLoadingGames(true);
    setGames([]);

    try {
      const url = `${API_BASE}/players/${person_id}/boxscores?limit=50`;
      const res = await fetch(url);
      const data = await res.json();
      setGames(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setGames([]);
    } finally {
      setLoadingGames(false);
    }
  }

  // small UX: press Enter to search
  function onKeyDown(e) {
    if (e.key === "Enter") doSearch();
  }

  const header = useMemo(() => {
    if (!selected) return "Search a player to see last 50 games";
    return `${selected.person_name} — last ${games.length || 0} games`;
  }, [selected, games.length]);

  return (
    <div style={{ fontFamily: "system-ui", background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>NBA Stats</h1>
          <a href="/" style={{ fontSize: 14, opacity: 0.8, textDecoration: "none" }}>
            ← Back to Polymarket page
          </a>
        </div>

        <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: "white", boxShadow: "0 6px 18px rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type player name (min 2 chars) … e.g. LeBron, Curry, Butler"
              style={{
                flex: "1 1 380px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.15)",
                fontSize: 16
              }}
            />
            <button
              onClick={doSearch}
              disabled={!canSearch || loadingSearch}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.15)",
                background: canSearch ? "white" : "rgba(0,0,0,.03)",
                cursor: canSearch ? "pointer" : "not-allowed",
                fontSize: 15
              }}
            >
              {loadingSearch ? "Searching…" : "Search"}
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
            Tip: press <b>Enter</b> to search.
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {results.map((p) => (
              <button
                key={p.person_id}
                onClick={() => loadPlayer(p.person_id, p.person_name)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 12,
                  border: selected?.person_id === p.person_id ? "2px solid rgba(0,0,0,.35)" : "1px solid rgba(0,0,0,.12)",
                  background: "white",
                  cursor: "pointer"
                }}
                title="Click to load last 50 games"
              >
                <div style={{ fontWeight: 700 }}>{p.person_name}</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>
                  ID: {p.person_id} {p.position ? `• ${p.position}` : ""} {p.team_id ? `• TeamID ${p.team_id}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "white", boxShadow: "0 6px 18px rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{header}</h2>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Source: local SQLite (your imports)
            </div>
          </div>

          {loadingGames && <div style={{ marginTop: 10 }}>Loading games…</div>}

          {!loadingGames && selected && games.length === 0 && (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              No games found for this player yet (or not in your imported files).
            </div>
          )}

          {!loadingGames && games.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Date", "Season", "Team", "Opp", "H/A", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "+/-"].map((h) => (
                      <th key={h} style={{ padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,.12)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={`${g.game_id}-${g.game_date}-${g.team_tricode || ""}`} style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                      <td style={{ padding: "8px 6px" }}>{safe(g.game_date)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.season_year)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.team_tricode)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.opponent_tricode)}</td>
                      <td style={{ padding: "8px 6px" }}>{fmtHomeAway(g.is_home)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.minutes)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.pts)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.reb)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.ast)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.stl)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.blk)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.tov)}</td>
                      <td style={{ padding: "8px 6px" }}>{safe(g.plus_minus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
          URL: <code>/nba/</code> (NBA UI) • <code>/</code> (Polymarket UI) • API under <code>/api/nba/*</code>
        </div>
      </div>
    </div>
  );
}
