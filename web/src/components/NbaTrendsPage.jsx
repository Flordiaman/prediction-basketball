
console.log("🔥🔥 RENDERING NbaTrendsPage.jsx (charts)");

import React, { useEffect, useMemo, useState } from "react";
import PlayerSearch from "./PlayerSearch.jsx";
import PlayerTrends from "./PlayerTrends.jsx";

const styles = {
  glass: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(0,0,0,.18)",
  },
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  input: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  err: { marginTop: 10, fontSize: 12, color: "rgba(255,120,120,0.95)" },
  hint: { fontSize: 12, opacity: 0.75 },
  analysisCard: {
    marginTop: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.14)",
    padding: 12,
  },
  analysisTitle: { fontWeight: 900, marginBottom: 6 },
  bullets: { margin: 0, paddingLeft: 18, opacity: 0.9, lineHeight: 1.35 },
};

function normRows(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.rows)) return x.rows;
  if (Array.isArray(x.data)) return x.data;
  return [];
}

export default function NbaTrendsPage() {
  const [selected, setSelected] = useState(null);
  const playerId = selected?.id || selected?.person_id || null;
  const playerName = selected?.person_name || "—";

  const [seasonYear, setSeasonYear] = useState("");
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [errGames, setErrGames] = useState("");

  const canLoad = !!playerId;

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
      const rows = normRows(data);

      // ensure we have a game_date field and correct ordering
      const sorted = rows
        .slice()
        .sort((a, b) => String(a.game_date).localeCompare(String(b.game_date)));

      setGames(sorted);
    } catch (e) {
      console.error("loadGames failed:", e);
      setGames([]);
      setErrGames("Player game load failed");
    } finally {
      setLoadingGames(false);
    }
  }

  useEffect(() => {
    if (!playerId) return;
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, seasonYear]);

  const narrative = useMemo(() => {
    if (!games || games.length < 6) return null;

    // quick “narrative shell” you can expand later
    const last = games.slice(-8);
    const first = games.slice(0, 8);

    const avg = (arr, key) => arr.reduce((s, g) => s + Number(g[key] ?? 0), 0) / Math.max(1, arr.length);

    const ptsUp = avg(last, "pts") - avg(first, "pts");
    const astUp = avg(last, "ast") - avg(first, "ast");
    const tovUp = avg(last, "tov") - avg(first, "tov");

    const bullets = [];
    bullets.push(`Recent form: last ${last.length} vs first ${first.length} games.`);

    bullets.push(
      `Scoring trend: ${ptsUp >= 0 ? "up" : "down"} (${ptsUp >= 0 ? "+" : ""}${ptsUp.toFixed(1)} pts on average).`
    );

    bullets.push(
      `Playmaking: ${astUp >= 0 ? "up" : "down"} (${astUp >= 0 ? "+" : ""}${astUp.toFixed(1)} assists on average).`
    );

    bullets.push(
      `Ball security: turnovers ${tovUp >= 0 ? "worse" : "better"} (${tovUp >= 0 ? "+" : ""}${tovUp.toFixed(1)} on average).`
    );

    bullets.push("Next: add minutes-adjusted trends + opponent strength + rolling averages + confidence text.");

    return bullets;
  }, [games]);

  return (
    <div style={styles.glass}>
      <div style={styles.row}>
        <div>
          <div style={{ fontWeight: 900 }}>Trends + Analysis</div>
          <div style={styles.hint}>Graphs + narrative (this is the “cool” page)</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={styles.input}
            value={seasonYear}
            onChange={(e) => setSeasonYear(e.target.value)}
            placeholder="Season year (optional)"
          />
          <button style={styles.btn} onClick={loadGames} disabled={!canLoad || loadingGames}>
            {loadingGames ? "Loading…" : "Reload"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={styles.hint}>Search players + view last 25 games</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Selected: <strong>{playerName}</strong>
          {playerId ? <span style={{ opacity: 0.7 }}> #{playerId}</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <PlayerSearch
          onSelectPlayer={(p) => {
            setSelected(p);
            setErrGames("");
            setGames([]);
          }}
        />
      </div>

      {errGames ? <div style={styles.err}>{errGames}</div> : null}

      {/* Graphs */}
      {games.length > 0 ? (
        <>
          <PlayerTrends games={games} />

          {/* Narrative / analysis */}
          <div style={styles.analysisCard}>
            <div style={styles.analysisTitle}>Narrative</div>
            {!narrative ? (
              <div style={{ opacity: 0.75, fontSize: 13 }}>Not enough games loaded yet.</div>
            ) : (
              <ul style={styles.bullets}>
                {narrative.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, opacity: 0.75, fontSize: 13 }}>
          {canLoad ? (loadingGames ? "Loading games…" : "No games loaded yet.") : "Pick a player above."}
        </div>
      )}
    </div>
  );
}
