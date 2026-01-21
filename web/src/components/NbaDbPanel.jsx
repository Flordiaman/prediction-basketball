import React, { useState } from "react";
import PlayerSearch from "./PlayerSearch";

const API_BASE = ""; // keep blank for Render + proxy

export default function NbaDbPanel() {
  const [selected, setSelected] = useState(null);
  const [season, setSeason] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadPlayer(person) {
    setSelected(person);
    setLoading(true);
    setErr("");

    try {
      const url =
        `${API_BASE}/api/nba/db/player/${person.person_id}?limit=25` +
        (season ? `&season=${encodeURIComponent(season)}` : "");

      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const data = await r.json();
      setGames(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr("Player game load failed");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8, color: "#111827" }}>
        NBA DB (2010–2024)
      </div>

      <PlayerSearch
        onSelectPlayer={(p) => {
          loadPlayer(p);
        }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Season year (optional)"
          style={{
            width: 180,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#111827",
          }}
        />
        {selected ? (
          <button
            onClick={() => loadPlayer(selected)}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              cursor: loading ? "not-allowed" : "pointer",
              color: "#111827",
              fontWeight: 700,
            }}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        ) : (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Pick a player above.
          </div>
        )}

        {selected ? (
          <button
            onClick={() => {
              setSelected(null);
              setGames([]);
              setErr("");
            }}
            style={{
              marginLeft: "auto",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              color: "#111827",
              fontWeight: 700,
            }}
          >
            Change Player
          </button>
        ) : null}
      </div>

      {err ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
          {err}
        </div>
      ) : null}

      {selected ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, color: "#111827" }}>
            {selected.display_first_last ||
              selected.person_name ||
              `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim()}{" "}
            (#{selected.person_id})
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#111827" }}>
              Last games (max 25)
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thLeft}>Date</th>
                    <th style={thLeft}>Type</th>
                    <th style={thLeft}>Team</th>
                    <th style={thRight}>PTS</th>
                    <th style={thRight}>REB</th>
                    <th style={thRight}>AST</th>
                    <th style={thRight}>STL</th>
                    <th style={thRight}>BLK</th>
                    <th style={thRight}>TOV</th>
                    <th style={thRight}>+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={`${g.game_id}-${g.game_date}`}>
                      <td style={tdLeft}>{String(g.game_date).slice(0, 10)}</td>
                      <td style={tdLeft}>{g.season_type}</td>
                      <td style={tdLeft}>{g.team_tricode || g.team_id}</td>
                      <td style={tdRight}>{g.pts ?? ""}</td>
                      <td style={tdRight}>{g.reb ?? ""}</td>
                      <td style={tdRight}>{g.ast ?? ""}</td>
                      <td style={tdRight}>{g.stl ?? ""}</td>
                      <td style={tdRight}>{g.blk ?? ""}</td>
                      <td style={tdRight}>{g.tov ?? ""}</td>
                      <td style={tdRight}>{g.plus_minus ?? ""}</td>
                    </tr>
                  ))}

                  {games.length === 0 ? (
                    <tr>
                      <td style={tdLeft} colSpan={10}>
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

const thLeft = {
  textAlign: "left",
  padding: 8,
  fontSize: 12,
  color: "#374151",
  borderBottom: "1px solid #e5e7eb",
};

const thRight = {
  textAlign: "right",
  padding: 8,
  fontSize: 12,
  color: "#374151",
  borderBottom: "1px solid #e5e7eb",
};

const tdLeft = {
  padding: 8,
  fontSize: 12,
  color: "#111827",
  borderBottom: "1px solid #f3f4f6",
};

const tdRight = {
  padding: 8,
  fontSize: 12,
  color: "#111827",
  borderBottom: "1px solid #f3f4f6",
  textAlign: "right",
};
