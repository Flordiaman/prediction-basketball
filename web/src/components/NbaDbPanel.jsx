import React, { useEffect, useMemo, useState } from "react";
import PlayerSearch from "./PlayerSearch";


const styles = {
  pageWrap: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
      padding: "22px 16px 120px", // ⬅ extra bottom padding
  },
  title: { fontSize: 28, fontWeight: 900, marginBottom: 2 },
  sub: { opacity: 0.8, marginBottom: 16 },

  glass: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.40)",
    backdropFilter: "blur(12px)",
    padding: 18,
  },

  grid: { display: "grid", gap: 14 },

  topRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },

  btn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 700,
  },

  input: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    width: 200,
  },

  err: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255, 80, 80, 0.12)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
  },

  sectionTitle: { fontWeight: 900, marginTop: 6, marginBottom: 8 },

  tableWrap: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    overflow: "auto",
    background: "rgba(0,0,0,0.12)",
     maxHeight: "60vh", // <-- ADD THIS
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    opacity: 0.85,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
  },
};

function normRows(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map((g) => ({
    game_date: g.game_date,
    team_tricode: g.team_tricode,
    pts: g.pts,
    reb: g.reb,
    ast: g.ast,
    stl: g.stl,
    blk: g.blk,
    tov: g.tov,
    plus_minus: g.plus_minus,
  }));
}

export default function NbaDbPanel() {
  const [selected, setSelected] = useState(null); // { id?, person_id?, person_name }
  const [seasonYear, setSeasonYear] = useState("");
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [errGames, setErrGames] = useState("");

  const playerName = selected?.person_name || "Pick a player";
  const playerId = selected?.id ?? selected?.person_id;
  const canLoad = Boolean(playerId);

  async function loadGames() {
    if (!playerId) return;

    setLoadingGames(true);
    setErrGames("");

    try {
      const qs = new URLSearchParams();
      qs.set("limit", "25");
      if (seasonYear.trim()) qs.set("season", seasonYear.trim());

      const url = `/api/nba/db/player/${playerId}?${qs.toString()}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const data = await r.json();
        const rows = Array.isArray(data) ? data : (data.rows || data.items || data.data || []);
        setGames(rows.slice().sort((a,b)=>String(a.game_date).localeCompare(String(b.game_date))));

    } catch (e) {
      console.error("loadGames failed:", e);
      setGames([]);
      setErrGames("Player game load failed");
    } finally {
      setLoadingGames(false);
    }
  }

  // auto-load when player or season changes
  useEffect(() => {
    if (!playerId) return;
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, seasonYear]);

  const headerRight = useMemo(() => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input
        style={styles.input}
        value={seasonYear}
        onChange={(e) => setSeasonYear(e.target.value)}
        placeholder="Season year (optional)"
      />
      <button style={styles.btn} onClick={loadGames} disabled={!canLoad || loadingGames}>
        {loadingGames ? "Loading..." : "Reload"}
      </button>
    </div>
  ), [seasonYear, canLoad, loadingGames]);

  return (
    <div style={styles.pageWrap}>
      <div style={styles.title}>Blurift — NBA</div>
      <div style={styles.sub}>Player search + last games + trends (scalable foundation)</div>

      <div style={styles.glass}>
        <div style={styles.grid}>
          <div style={styles.topRow}>
            <div style={{ fontWeight: 900 }}>NBA DB (2010–2024)</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              Search players + view last 25 games
            </div>
          </div>

          <PlayerSearch
            onSelectPlayer={(p) => {
              setSelected(p);
              setErrGames("");
              setGames([]);
            }}
          />

          <div style={styles.topRow}>
            {headerRight}
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Selected: <strong>{playerName}</strong>
              {playerId ? <span style={{ opacity: 0.7 }}> #{playerId}</span> : null}
            </div>
          </div>

          {errGames && <div style={styles.err}>{errGames}</div>}

          {/*games.length > 0 && <PlayerTrends games={games} />*/}

          <div>
            <div style={styles.sectionTitle}>Last games (max 25)</div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Team</th>
                    <th style={styles.th}>PTS</th>
                    <th style={styles.th}>REB</th>
                    <th style={styles.th}>AST</th>
                    <th style={styles.th}>STL</th>
                    <th style={styles.th}>BLK</th>
                    <th style={styles.th}>TOV</th>
                    <th style={styles.th}>+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {games.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={9}>
                        {canLoad
                          ? loadingGames
                            ? "Loading..."
                            : "No games loaded yet."
                          : "Pick a player above."}
                      </td>
                    </tr>
                  ) : (
                    games
                      .slice()
                      .sort((a, b) =>
                        String(b.game_date).localeCompare(String(a.game_date))
                      )
                      .map((g, idx) => (
                        <tr key={`${g.game_date}-${idx}`}>
                          <td style={styles.td}>{String(g.game_date || "").slice(0, 10)}</td>
                          <td style={styles.td}>{g.team_tricode || ""}</td>
                          <td style={styles.td}>{g.pts}</td>
                          <td style={styles.td}>{g.reb}</td>
                          <td style={styles.td}>{g.ast}</td>
                          <td style={styles.td}>{g.stl}</td>
                          <td style={styles.td}>{g.blk}</td>
                          <td style={styles.td}>{g.tov}</td>
                          <td style={styles.td}>{g.plus_minus}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Next upgrades: minutes-adjusted trends, opponent strength, rolling averages,
            player-vs-player overlays, team splits, and behavior narrative.
          </div>
        </div>
      </div>
    </div>
  );
}
