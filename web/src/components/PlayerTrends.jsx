import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

function toShortDate(isoOrText) {
  const s = String(isoOrText || "");
  return s.length >= 10 ? s.slice(5, 10) : s;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function slope(values) {
  const y = values.map(safeNum);
  const n = y.length;
  if (n < 2) return 0;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function pctChange(a, b) {
  const A = safeNum(a);
  const B = safeNum(b);
  if (A === 0) return B === 0 ? 0 : 1;
  return (B - A) / Math.abs(A);
}

function trendLabel(metricName, series, opts = {}) {
  const n = series.length;
  if (n < 6) return { label: "Not enough games to judge trend.", tone: "neutral" };

  const firstN = opts.firstN ?? Math.min(8, Math.floor(n / 2));
  const lastN = opts.lastN ?? Math.min(8, Math.floor(n / 2));

  const first = series.slice(0, firstN);
  const last = series.slice(n - lastN);

  const avg = (arr) => arr.reduce((s, v) => s + safeNum(v), 0) / Math.max(1, arr.length);

  const a0 = avg(first);
  const a1 = avg(last);
  const pc = pctChange(a0, a1);
  const sl = slope(series);

  const down = pc <= -0.12 && sl < 0;
  const up = pc >= 0.12 && sl > 0;

  if (down) {
    return { label: `${metricName} is trending down (${Math.round(pc * 100)}% vs early games).`, tone: "down" };
  }
  if (up) {
    return { label: `${metricName} is trending up (+${Math.round(pc * 100)}% vs early games).`, tone: "up" };
  }
  return { label: `${metricName} looks mostly steady (no strong change detected).`, tone: "neutral" };
}

function minMax(arr) {
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of arr) {
    const n = safeNum(v);
    if (n < mn) mn = n;
    if (n > mx) mx = n;
  }
  if (!Number.isFinite(mn)) mn = 0;
  if (!Number.isFinite(mx)) mx = 0;
  return { mn, mx };
}

function normalizeValue(v, mn, mx) {
  const n = safeNum(v);
  if (mx === mn) return 50; // flat line
  return ((n - mn) / (mx - mn)) * 100;
}

const styles = {
  wrap: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.10)",
    padding: 12,
  },
  headRow: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" },
  title: { fontSize: 14, fontWeight: 900, opacity: 0.95 },
  sub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  controls: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  pill: (active) => ({
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  }),
  grid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  card: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.10)",
    padding: 10,
  },
  cardTitle: { fontSize: 12, fontWeight: 900, opacity: 0.9, marginBottom: 6 },
  chartWrap: { width: "100%", height: 220 },
  note: { marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.35 },
};

const METRICS = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "plus_minus", label: "+/-" },
];

export default function PlayerTrends({ games }) {
  const [mode, setMode] = useState("multiples"); // multiples | overlay
  const [normalize, setNormalize] = useState(true);

  const [enabled, setEnabled] = useState(() => {
    const init = {};
    METRICS.forEach((m) => (init[m.key] = m.key === "pts" || m.key === "tov" || m.key === "ast"));
    return init;
  });

  const data = useMemo(() => {
    const arr = Array.isArray(games) ? games : [];
    const sorted = arr
      .slice()
      .sort((a, b) => String(a.game_date).localeCompare(String(b.game_date)));

    return sorted.map((g) => ({
      date: toShortDate(g.game_date),
      game_date: g.game_date,
      pts: safeNum(g.pts),
      reb: safeNum(g.reb),
      ast: safeNum(g.ast),
      stl: safeNum(g.stl),
      blk: safeNum(g.blk),
      tov: safeNum(g.tov),
      plus_minus: safeNum(g.plus_minus),
    }));
  }, [games]);

  const enabledKeys = useMemo(
    () => METRICS.map((m) => m.key).filter((k) => enabled[k]),
    [enabled]
  );

  const overlayData = useMemo(() => {
    if (!normalize) return data;

    // per-metric min/max across series for 0..100 scaling
    const ranges = {};
    for (const m of METRICS) {
      const series = data.map((d) => d[m.key]);
      ranges[m.key] = minMax(series);
    }

    return data.map((d) => {
      const out = { ...d };
      for (const m of METRICS) {
        const { mn, mx } = ranges[m.key];
        out[m.key] = normalizeValue(d[m.key], mn, mx);
      }
      return out;
    });
  }, [data, normalize]);

  const headline = useMemo(() => {
    if (data.length < 6 || enabledKeys.length === 0) return null;

    // pick first enabled metric to summarize
    const m = METRICS.find((x) => enabledKeys.includes(x.key)) || METRICS[0];
    const series = data.map((d) => d[m.key]);
    return trendLabel(m.label, series);
  }, [data, enabledKeys]);

  if (!Array.isArray(games) || games.length === 0) {
    return (
      <div style={styles.wrap}>
        <div style={styles.title}>Trends</div>
        <div style={styles.sub}>Select a player to see trends.</div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.headRow}>
        <div>
          <div style={styles.title}>Trends (last 25 games)</div>
          {headline ? <div style={styles.sub}>{headline.label}</div> : <div style={styles.sub}>—</div>}
        </div>

        <div style={styles.controls}>
          <button style={styles.pill(mode === "multiples")} onClick={() => setMode("multiples")}>
            Small multiples
          </button>
          <button style={styles.pill(mode === "overlay")} onClick={() => setMode("overlay")}>
            Overlay
          </button>
          <button style={styles.pill(normalize)} onClick={() => setNormalize((v) => !v)}>
            Normalize {normalize ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* metric toggles */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            style={styles.pill(!!enabled[m.key])}
            onClick={() => setEnabled((prev) => ({ ...prev, [m.key]: !prev[m.key] }))}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "overlay" ? (
        <div style={{ ...styles.card, marginTop: 12 }}>
          <div style={styles.cardTitle}>
            Overlay chart {normalize ? "(0–100 scaled)" : ""}
          </div>
          <div style={styles.chartWrap}>
            <ResponsiveContainer>
              <LineChart data={overlayData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={normalize ? [0, 100] : ["auto", "auto"]} />
                <Tooltip />
                <Legend />
                {METRICS.filter((m) => enabled[m.key]).map((m) => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {METRICS.filter((m) => enabled[m.key]).map((m) => {
            const series = data.map((d) => d[m.key]);
            const label = trendLabel(m.label, series);

            return (
              <div key={m.key} style={styles.card}>
                <div style={styles.cardTitle}>
                  {m.label} — {label.tone === "up" ? "up" : label.tone === "down" ? "down" : "steady"}
                </div>
                <div style={styles.chartWrap}>
                  <ResponsiveContainer>
                    <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={["auto", "auto"]} />
                      <Tooltip />
                      <Line type="monotone" dataKey={m.key} name={m.label} dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={styles.note}>
        This is a simple slope + early-vs-late average check (conservative thresholds). We’ll refine later for context
        (minutes, opponent, pace, injuries, etc.).
      </div>
    </div>
  );
}
