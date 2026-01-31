import React, { useEffect, useMemo, useState } from "react";

function fmtNum(v, digits = 1) {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  return n.toFixed(digits).replace(/\.0$/, ""); // 12.0 -> 12
}

export default function PlayerSearch({ apiBase = "" }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Optional: show a quick summary panel when clicking a player
  const [selected, setSelected] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryErr, setSummaryErr] = useState("");

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  async function runSearch(query) {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRows([]);
      setErr("");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      // NOTE: keep endpoint EXACT (don’t break anything)
      const url = `${apiBase}/api/nba/players/search?q=${encodeURIComponent(trimmed)}&limit=25`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary(personId) {
    setSummaryLoading(true);
    setSummaryErr("");
    try {
      const url = `${apiBase}/api/nba/players/${personId}/summary`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSelected(data);
    } catch (e) {
      setSummaryErr(String(e?.message || e));
      setSelected(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 10px 0" }}>NBA Player Search</h2>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Type a player name (e.g., "LeBron")'
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,.15)",
            fontSize: 14,
          }}
        />
        <button
          onClick={() => runSearch(q)}
          disabled={!canSearch || loading}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,.15)",
            background: loading ? "#eee" : "white",
            cursor: !canSearch || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
        Endpoint: <code>{apiBase}/api/nba/players/search</code>
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: "crimson" }}>Error: {err}</div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {rows.length === 0 && canSearch && !loading ? (
          <div style={{ opacity: 0.7 }}>No matches.</div>
        ) : null}

        {rows.map((p) => {
          const hasStats =
            p.gp !== undefined ||
            p.ppg !== undefined ||
            p.rpg !== undefined ||
            p.apg !== undefined;

          return (
            <div
              key={p.person_id}
              onClick={() => loadSummary(p.person_id)}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,.10)",
                marginBottom: 10,
                cursor: "pointer",
              }}
              title="Click for summary"
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.person_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                    {p.position ? p.position : "—"} {p.team_id ? `• Team ${p.team_id}` : ""}
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                  {hasStats ? (
                    <>
                      <div>GP: {p.gp ?? "–"}</div>
                      <div>
                        PPG {fmtNum(p.ppg)} • RPG {fmtNum(p.rpg)} • APG {fmtNum(p.apg)}
                      </div>
                    </>
                  ) : (
                    <div style={{ opacity: 0.65 }}>Stats not returned</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary panel */}
      <div style={{ marginTop: 18 }}>
        {summaryLoading ? <div>Loading player summary…</div> : null}
        {summaryErr ? <div style={{ color: "crimson" }}>Summary error: {summaryErr}</div> : null}

        {selected?.player ? (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,.15)",
              marginTop: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.player.person_name}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {selected.player.position || "—"}{" "}
              {selected.player.team_id ? `• Team ${selected.player.team_id}` : ""}
            </div>

            <div style={{ marginTop: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>Averages</div>
              {selected.averages ? (
                <div style={{ marginTop: 4 }}>
                  GP {selected.averages.gp ?? "–"} • PPG {fmtNum(selected.averages.ppg)} • RPG{" "}
                  {fmtNum(selected.averages.rpg)} • APG {fmtNum(selected.averages.apg)}
                </div>
              ) : (
                <div style={{ opacity: 0.7 }}>No averages available.</div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>Most Recent Game</div>
              {selected.lastGame ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ opacity: 0.8 }}>
                    {selected.lastGame.game_date ? String(selected.lastGame.game_date) : "—"}
                  </div>
                  <div style={{ marginTop: 2 }}>
                    PTS {selected.lastGame.pts ?? "–"} • REB {selected.lastGame.reb ?? "–"} • AST{" "}
                    {selected.lastGame.ast ?? "–"}
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.7 }}>No recent game found.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
