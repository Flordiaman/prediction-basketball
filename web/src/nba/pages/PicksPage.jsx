import React, { useEffect, useMemo, useState } from "react";
import { fetchPicks } from "../api/nbaApi";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function Pill({ text, tone = "neutral" }) {
  const map = {
    good: { border: "#0a7d00" },
    warn: { border: "#b06b00" },
    bad: { border: "#b00020" },
    neutral: { border: "#666" },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 999,
      border: `2px solid ${c.border}`,
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.3
    }}>
      {text}
    </span>
  );
}

function tierTone(tier) {
  if (tier === "STRONG") return "good";
  if (tier === "EDGE") return "good";
  if (tier === "LEAN") return "warn";
  return "bad";
}

export default function PicksPage() {
  const [date, setDate] = useState(todayStr());
  const [minConf, setMinConf] = useState(35);
  const [state, setState] = useState({ loading: true, err: null, data: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, err: null, data: null });
    (async () => {
      try {
        const data = await fetchPicks(date);
        if (!alive) return;
        setState({ loading: false, err: null, data });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, err: e.message || String(e), data: null });
      }
    })();
    return () => { alive = false; };
  }, [date]);

  const items = useMemo(() => {
    const raw = state.data?.items || [];
    return raw.filter(x => (x.confidence ?? 0) >= minConf);
  }, [state.data, minConf]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 1000 }}>Picks</div>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 800, opacity: 0.8 }}>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 800, opacity: 0.8 }}>Min confidence</span>
          <input
            type="number"
            value={minConf}
            min={0}
            max={100}
            onChange={(e) => setMinConf(Number(e.target.value || 0))}
            style={{ width: 90 }}
          />
        </label>

        <div style={{ marginLeft: "auto" }}>
          {state.data?.model ? <Pill text={`MODEL: ${state.data.model}`} /> : null}
        </div>
      </div>

      {state.loading && <p>Loading picks…</p>}
      {state.err && <p style={{ color: "#b00020" }}>Error: {state.err}</p>}

      {!state.loading && !state.err && (
        <>
          <div style={{ marginTop: 12, opacity: 0.85, fontWeight: 700 }}>
            Showing {items.length} pick(s) with confidence ≥ {minConf}.
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {items.map((p) => (
              <div key={p.id} style={{
                border: "2px solid #eee",
                borderRadius: 16,
                padding: 14
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 16, fontWeight: 1000 }}>
                    {p.player} — {p.side} {p.line}
                  </div>
                  <Pill text={p.tier} tone={tierTone(p.tier)} />
                  <Pill text={`Conf ${p.confidence}`} tone={p.confidence >= 50 ? "good" : "warn"} />
                  <Pill text={`Edge ${p.edge}`} tone={Math.abs(p.edge) >= 2 ? "good" : "warn"} />
                  <Pill text={`Vol ${p.volatility}`} tone={p.volatility >= 6 ? "warn" : "neutral"} />
                </div>

                <div style={{ marginTop: 10, opacity: 0.9 }}>
                  <div><b>Projected:</b> {p.projected} • <b>Last10 avg:</b> {p.last10_avg} • <b>Std:</b> {p.last10_std}</div>
                  <div><b>Team:</b> {p.team} vs {p.opponent} • <b>Sample:</b> {p.sample_n}</div>
                </div>

                {!!(p.warnings?.length) && (
                  <div style={{ marginTop: 10 }}>
                    {p.warnings.map((w, i) => (
                      <span key={i} style={{ marginRight: 8 }}>
                        <Pill text={w} tone="warn" />
                      </span>
                    ))}
                  </div>
                )}

                {!!(p.notes?.length) && (
                  <ul style={{ marginTop: 10, marginBottom: 0 }}>
                    {p.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                )}
              </div>
            ))}

            {items.length === 0 && (
              <div style={{ padding: 14, border: "2px dashed #ccc", borderRadius: 16 }}>
                No picks match your filter. Lower “Min confidence” or generate more picks.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
