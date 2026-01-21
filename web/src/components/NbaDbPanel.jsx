import React, { useState } from "react";
import PlayerSearch from "./PlayerSearch";

const API_BASE = ""; // keep blank for Render + same-origin

export default function NbaDbPanel() {
  const [selected, setSelected] = useState(null);
  const [season, setSeason] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadPlayer(person) {
    if (!person?.person_id) return;

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

  const selectedName =
    selected?.display_first_last ||
    selected?.person_name ||
    `${selected?.first_name ?? ""} ${selected?.last_name ?? ""}`.trim() ||
    "";

  return (
    <div style={S.panel}>
      <div style={S.headerRow}>
        <div style={S.title}>NBA DB (2010–2024)</div>
        <div style={S.subTitle}>Search players + view last 25 games</div>
      </div>

      {/* ONE search box only */}
      <PlayerSearch
        onSelectPlayer={(p) => {
          loadPlayer(p);
        }}
      />

      <div style={S.controlsRow}>
        <input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Season year (optional)"
          style={S.input}
        />

        {selected ? (
          <>
            <button
              onClick={() => loadPlayer(selected)}
              disabled={loading}
              style={{
                ...S.button,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading..." : "Reload"}
            </button>

            <button
              onClick={() => {
                setSelected(null);
                setGames([]);
                setErr("");
              }}
              style={S.buttonGhost}
            >
              Change Player
            </button>
          </>
        ) : (
          <div style={S.muted}>Pick a player above.</div>
        )}
      </div>

      {err ? <div style={S.error}>{err}</div> : null}

      {selected ? (
        <div style={{ marginTop: 12 }}>
          <div style={S.selectedRow}>
            <div style={S.selectedName}>
              {selectedName} <span style={S.selectedId}>#{selected.person_id}</span>
            </div>
          </div>

          <div style={S.tableWrap}>
            <div style={S.tableTitle}>Last games (max 25)</div>

            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.thLeft}>Date</th>
                    <th style={S.thLeft}>Type</th>
                    <th style={S.thLeft}>Team</th>
                    <th style={S.thRight}>PTS</th>
                    <th style={S.thRight}>REB</th>
                    <th style={S.thRight}>AST</th>
                    <th style={S.thRight}>STL</th>
                    <th style={S.thRight}>BLK</th>
                    <th style={S.thRight}>TOV</th>
                    <th style={S.thRight}>+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={`${g.game_id}-${g.game_date}`} style={S.tr}>
                      <td style={S.tdLeft}>{String(g.game_date).slice(0, 10)}</td>
                      <td style={S.tdLeft}>{g.season_type}</td>
                      <td style={S.tdLeft}>{g.team_tricode || g.team_id}</td>
                      <td style={S.tdRight}>{g.pts ?? ""}</td>
                      <td style={S.tdRight}>{g.reb ?? ""}</td>
                      <td style={S.tdRight}>{g.ast ?? ""}</td>
                      <td style={S.tdRight}>{g.stl ?? ""}</td>
                      <td style={S.tdRight}>{g.blk ?? ""}</td>
                      <td style={S.tdRight}>{g.tov ?? ""}</td>
                      <td style={S.tdRight}>{g.plus_minus ?? ""}</td>
                    </tr>
                  ))}

                  {games.length === 0 ? (
                    <tr>
                      <td style={S.tdEmpty} colSpan={10}>
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

const S = {
  // Force readable colors regardless of global theme
  panel: {
    padding: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#ffffff",
    color: "#111827",
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  title: { fontSize: 14, fontWeight: 900 },
  subTitle: { fontSize: 12, color: "#6b7280" },

  controlsRow: { display: "flex", gap: 8, alignItems: "center" },
  input: {
    width: 190,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    outline: "none",
  },

  button: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    color: "#111827",
    fontWeight: 800,
  },
  buttonGhost: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    marginLeft: "auto",
    cursor: "pointer",
  },

  muted: { fontSize: 12, color: "#6b7280" },
  error: { marginTop: 10, fontSize: 12, color: "#b91c1c", fontWeight: 700 },

  selectedRow: { marginTop: 10, marginBottom: 8 },
  selectedName: { fontSize: 14, fontWeight: 900 },
  selectedId: { fontSize: 12, color: "#6b7280", fontWeight: 800 },

  tableWrap: {
    marginTop: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    background: "#ffffff",
  },
  tableTitle: {
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 900,
    color: "#111827",
    background: "#f9fafb",
  },
  table: { width: "100%", borderCollapse: "collapse" },

  thLeft: {
    textAlign: "left",
    padding: 10,
    fontSize: 12,
    color: "#374151",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: 10,
    fontSize: 12,
    color: "#374151",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },

  tr: { borderBottom: "1px solid #f3f4f6" },

  tdLeft: { padding: 10, fontSize: 12, color: "#111827", whiteSpace: "nowrap" },
  tdRight: {
    padding: 10,
    fontSize: 12,
    color: "#111827",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  tdEmpty: { padding: 12, fontSize: 12, color: "#6b7280" },
};
