// src/pages/signal/SignalFeed.jsx
import React, { useMemo, useState } from "react";

/**
 * Blurift Landing Page (Signal Feed)
 * - Verbal is the default view (insight-first)
 * - Visual is optional drill-down (sparkline + metrics placeholders)
 * - Replace mockSignals with API data later
 */

const nowIso = () => new Date().toISOString();

function formatLocal(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function Pill({ children, tone = "neutral" }) {
  const styles = {
    base: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid rgba(255,255,255,.10)",
      background: "rgba(255,255,255,.04)",
      color: "rgba(255,255,255,.88)",
      userSelect: "none",
      whiteSpace: "nowrap",
    },
    positive: { borderColor: "rgba(53,208,127,.35)", background: "rgba(53,208,127,.08)" },
    caution: { borderColor: "rgba(255,199,0,.35)", background: "rgba(255,199,0,.08)" },
    negative: { borderColor: "rgba(255,77,109,.35)", background: "rgba(255,77,109,.08)" },
  };

  const toneStyle =
    tone === "positive" ? styles.positive : tone === "caution" ? styles.caution : tone === "negative" ? styles.negative : null;

  return <span style={{ ...styles.base, ...(toneStyle || {}) }}>{children}</span>;
}

function Toggle({ value, onChange }) {
  const base = {
    display: "inline-flex",
    borderRadius: 999,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.15)",
  };

  const btn = (active) => ({
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    border: "none",
    color: active ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.70)",
    background: active ? "rgba(255,255,255,.09)" : "transparent",
  });

  return (
    <div style={base} role="tablist" aria-label="View mode">
      <button type="button" style={btn(value === "verbal")} onClick={() => onChange("verbal")} role="tab" aria-selected={value === "verbal"}>
        Verbal
      </button>
      <button type="button" style={btn(value === "visual")} onClick={() => onChange("visual")} role="tab" aria-selected={value === "visual"}>
        Visual
      </button>
    </div>
  );
}

function MiniSpark({ points = [] }) {
  // lightweight sparkline without libs
  const w = 220;
  const h = 44;
  const pad = 4;

  const safe = points.length ? points : [10, 11, 10, 12, 14, 13, 15, 16, 15];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = max - min || 1;

  const toX = (i) => pad + (i * (w - pad * 2)) / (safe.length - 1);
  const toY = (v) => pad + (h - pad * 2) * (1 - (v - min) / span);

  const d = safe
    .map((v, i) => {
      const x = toX(i);
      const y = toY(v);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,.70)" strokeWidth="2" />
    </svg>
  );
}

function ScoreBar({ label, value }) {
  // value: 0..100
  const v = clamp(value, 0, 100);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 46px", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.70)" }}>{label}</div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${v}%`, background: "rgba(255,255,255,.55)" }} />
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)", textAlign: "right" }}>{v}</div>
    </div>
  );
}

function toneFromDirection(dir) {
  if (dir === "up") return "positive";
  if (dir === "down") return "negative";
  return "caution";
}

function SignalCard({ signal, mode }) {
  const card = {
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    boxShadow: "0 12px 30px rgba(0,0,0,.25)",
  };

  const titleRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };

  const title = { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" };

  const h3 = { margin: 0, fontSize: 16, color: "rgba(255,255,255,.95)", letterSpacing: ".2px" };

  const sub = { fontSize: 12, color: "rgba(255,255,255,.70)" };

  return (
    <div style={card}>
      <div style={titleRow}>
        <div style={title}>
          <h3 style={h3}>{signal.title}</h3>
          <span style={sub}>{signal.scope}</span>
        </div>

        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={toneFromDirection(signal.direction)}>
            {signal.direction === "up" ? "▲" : signal.direction === "down" ? "▼" : "•"} {signal.label}
          </Pill>
          <Pill>{signal.confidence}% confidence</Pill>
          <Pill>{signal.horizon}</Pill>
        </div>
      </div>

      {/* Verbal (default) */}
      {mode === "verbal" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,.90)" }}>{signal.verbal}</div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {signal.tags.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,.65)" }}>
            Updated: <span style={{ color: "rgba(255,255,255,.82)" }}>{formatLocal(signal.updated_at)}</span>
          </div>
        </div>
      )}

      {/* Visual (drill-down) */}
      {mode === "visual" && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.80)" }}>Recent movement</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>Updated: {formatLocal(signal.updated_at)}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <MiniSpark points={signal.spark} />
            <div style={{ display: "grid", gap: 8, minWidth: 280, flex: "1 1 280px" }}>
              <ScoreBar label="Momentum" value={signal.momentum} />
              <ScoreBar label="Volatility" value={signal.volatility} />
              <ScoreBar label="Narrative Heat" value={signal.heat} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>Price: {signal.metrics.price}</Pill>
            <Pill>Volume: {signal.metrics.volume}</Pill>
            <Pill>MA shift: {signal.metrics.ma_shift}</Pill>
          </div>

          <div style={{ fontSize: 12, color: "rgba(255,255,255,.70)" }}>
            Visuals are *secondary* here — the words stay in charge.
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignalFeed() {
  const [mode, setMode] = useState("verbal"); // verbal is default (per Blurift philosophy)
  const [query, setQuery] = useState("");

  // Mock signals: replace with API later (e.g. GET /api/signal/feed)
  const mockSignals = useMemo(
    () => [
      {
        id: "sig_001",
        title: "Liquidity shifted toward the front page",
        scope: "System / Attention",
        label: "Shift",
        direction: "up",
        confidence: 72,
        horizon: "Next 6–24h",
        verbal:
          "Attention is clustering into fewer topics. That usually means one storyline is pulling oxygen from everything else. If the cluster holds while volatility stays elevated, we treat it as a real regime change — not noise.",
        tags: ["behavior", "attention", "regime"],
        updated_at: nowIso(),
        spark: [12, 12, 13, 14, 14, 15, 15, 16, 15, 16, 17],
        momentum: 68,
        volatility: 57,
        heat: 74,
        metrics: { price: "—", volume: "↑", ma_shift: "mild" },
      },
      {
        id: "sig_002",
        title: "Late push looked real, but confirmation is missing",
        scope: "Market / Event",
        label: "Watch",
        direction: "flat",
        confidence: 61,
        horizon: "Next 2–8h",
        verbal:
          "We saw a sharp move, but follow-through is thin. Blurift reads this as a ‘probe’ unless volume confirms. If volume pops and the average shifts, we upgrade this to a trend signal.",
        tags: ["confirmation", "volume", "follow-through"],
        updated_at: nowIso(),
        spark: [18, 17, 17, 16, 16, 17, 18, 17, 16, 16, 16],
        momentum: 49,
        volatility: 43,
        heat: 52,
        metrics: { price: "—", volume: "↔", ma_shift: "none" },
      },
      {
        id: "sig_003",
        title: "Downside pressure is organized, not random",
        scope: "Market / Risk",
        label: "Pressure",
        direction: "down",
        confidence: 77,
        horizon: "Next 24–72h",
        verbal:
          "Selling pressure is consistent across intervals, which usually means the ‘why’ is shared. If you’re looking for a fade, wait for the behavior to change first — price will follow.",
        tags: ["risk", "pressure", "behavior-first"],
        updated_at: nowIso(),
        spark: [22, 21, 20, 20, 19, 18, 18, 17, 16, 16, 15],
        momentum: 72,
        volatility: 66,
        heat: 61,
        metrics: { price: "—", volume: "↑", ma_shift: "strong" },
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockSignals;
    return mockSignals.filter((s) => {
      const hay = `${s.title} ${s.scope} ${s.label} ${s.verbal} ${s.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [mockSignals, query]);

  const page = {
    minHeight: "100vh",
    padding: "28px 18px 60px",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(98,126,255,.18), transparent 55%), radial-gradient(900px 500px at 85% 20%, rgba(53,208,127,.12), transparent 55%), radial-gradient(900px 500px at 30% 85%, rgba(255,199,0,.10), transparent 55%), linear-gradient(180deg, rgba(8,10,18,1) 0%, rgba(10,12,24,1) 50%, rgba(6,7,14,1) 100%)",
    color: "white",
  };

  const shell = { maxWidth: 1100, margin: "0 auto" };

  const header = {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  };

  const brand = { display: "grid", gap: 6 };
  const logo = { fontSize: 22, letterSpacing: ".4px", margin: 0 };
  const tagline = { fontSize: 13, color: "rgba(255,255,255,.72)", margin: 0, maxWidth: 640, lineHeight: 1.4 };

  const controls = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };

  const search = {
    width: 320,
    maxWidth: "80vw",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
  };

  const grid = { marginTop: 18, display: "grid", gridTemplateColumns: "1fr", gap: 14 };

  return (
    <div style={page}>
      <div style={shell}>
        <div style={header}>
          <div style={brand}>
            <h1 style={logo}>Blurift</h1>
            <p style={tagline}>
              Verbal-first signals. Visuals only when they earn it. <span style={{ color: "rgba(255,255,255,.92)" }}>Price is the effect — behavior is the cause.</span>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>Feed</Pill>
              <Pill>Live-ish</Pill>
              <Pill>Interpretation &gt; Noise</Pill>
            </div>
          </div>

          <div style={controls}>
            <input
              style={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search signals… (behavior, volume, regime)"
              aria-label="Search signals"
            />
            <Toggle value={mode} onChange={setMode} />
          </div>
        </div>

        <div style={grid}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,.88)" }}>No signals match that search.</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.65)" }}>Try fewer words or a different tag.</div>
            </div>
          ) : (
            filtered.map((s) => <SignalCard key={s.id} signal={s} mode={mode} />)
          )}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "rgba(255,255,255,.60)" }}>
          Next step: replace mock data with your feed endpoint and tie “confidence / momentum / volatility” to real metrics (volume, price, MA shift, etc.).
        </div>
      </div>
    </div>
  );
}
