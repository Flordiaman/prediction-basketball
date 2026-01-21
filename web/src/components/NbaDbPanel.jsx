import React, { useEffect, useState } from "react";
import PlayerSearch from "./PlayerSearch";

const API_BASE = ""; // local dev; later we’ll switch to relative for Render

export default function NbaDbPanel() {
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [season, setSeason] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
    const [person, setPerson] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setErr("");
      if (!q.trim()) {
        setPlayers([]);
        return;
      }
      try {
        const r = await fetch(
          `${API_BASE}/api/nba/db/players?q=${encodeURIComponent(q)}&limit=10`
        );
        const data = await r.json();
        setPlayers(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr("Player search failed");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function loadPlayer(person) {
    setSelected(person);
    setLoading(true);
    setErr("");
    try {
      const url =
  `/api/nba/db/player/${person.person_id}?limit=25` +
  (season ? `&season=${encodeURIComponent(season)}` : "");


      const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const data = await r.json();
      setGames(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr("Player game load failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>NBA DB (2010–2024)</div>
            <PlayerSearch onSelectPlayer={setPerson} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player (e.g., LeBron)"
          style={{ flex: 1, padding: 8 }}
        />
        <input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Season year (optional)"
          style={{ width: 160, padding: 8 }}
        />
      </div>

      {err ? <div style={{ marginTop: 8 }}>{err}</div> : null}

      {players.length > 0 && !selected ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Matches</div>
          <div style={{ display: "grid", gap: 6 }}>
            {players.map((p) => (
              <button
                key={p.person_id}
                onClick={() => loadPlayer(p)}
                style={{ padding: 8, textAlign: "left", cursor: "pointer" }}
              >
                {p.person_name} (ID: {p.person_id})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>
              {selected.person_name} (#{selected.person_id})
            </div>
            <button
              onClick={() => {
                setSelected(null);
                setGames([]);
              }}
              style={{ padding: "6px 10px", cursor: "pointer" }}
            >
              Change
            </button>
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => loadPlayer(selected)}
              style={{ padding: "6px 10px", cursor: "pointer" }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Reload"}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Last games (max 25)
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 6 }}>Date</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Type</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Team</th>
                    <th style={{ textAlign: "right", padding: 6 }}>PTS</th>
                    <th style={{ textAlign: "right", padding: 6 }}>REB</th>
                    <th style={{ textAlign: "right", padding: 6 }}>AST</th>
                    <th style={{ textAlign: "right", padding: 6 }}>STL</th>
                    <th style={{ textAlign: "right", padding: 6 }}>BLK</th>
                    <th style={{ textAlign: "right", padding: 6 }}>TOV</th>
                    <th style={{ textAlign: "right", padding: 6 }}>+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={`${g.game_id}-${g.game_date}`}>
                      <td style={{ padding: 6 }}>{String(g.game_date).slice(0, 10)}</td>
                      <td style={{ padding: 6 }}>{g.season_type}</td>
                      <td style={{ padding: 6 }}>{g.team_tricode || g.team_id}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.pts ?? ""}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.reb ?? ""}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.ast ?? ""}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.stl ?? ""}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.blk ?? ""}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.tov ?? ""}</td>
                      <td style={{ padding: 6, textAlign: "right" }}>{g.plus_minus ?? ""}</td>
                    </tr>
                  ))}
                  {games.length === 0 ? (
                    <tr>
                      <td style={{ padding: 6 }} colSpan={10}>
                        No games loaded yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
