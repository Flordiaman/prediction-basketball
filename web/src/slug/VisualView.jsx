import React from "react";

function StatTile({ label, value }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.18)",
        color: "rgba(255,255,255,.92)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
        {value}
      </div>
    </div>
  );
}

function PlaceholderChart() {
  return (
    <div
      style={{
        height: 280,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.18)",
        position: "relative",
        overflow: "hidden",
        color: "rgba(255,255,255,.92)",
      }}
    >
      {/* subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.18,
          pointerEvents: "none",
        }}
      />

      {/* fake line */}
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <path
          d="M0,230 C100,210 160,250 250,220 C340,190 420,210 520,170 C610,130 700,160 780,120 C860,80 920,110 1000,70"
          fill="none"
          stroke="rgba(255,255,255,.75)"
          strokeWidth="4"
        />
        <path
          d="M0,230 C100,210 160,250 250,220 C340,190 420,210 520,170 C610,130 700,160 780,120 C860,80 920,110 1000,70 L1000,300 L0,300 Z"
          fill="rgba(255,255,255,.06)"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: -0.4 }}>Price (placeholder)</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>1D • 1W • 1M • 1Y</div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        Visual shell only — real series plugs in later.
      </div>
    </div>
  );
}

export default function VisualView({ narrative }) {
  const tone = narrative?.tone || "neutral";
  const confidence = narrative?.confidence ?? 0;

  return (
    <section style={{ display: "grid", gap: 12 }}>
      {/* Top tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <StatTile label="Tone" value={tone} />
        <StatTile label="Confidence" value={`${Math.round(confidence * 100)}%`} />
        <StatTile label="Trend" value="—" />
        <StatTile label="Volatility" value="—" />
      </div>

      {/* Chart */}
      <PlaceholderChart />

      {/* Bottom strip */}
      <div
        style={{
          padding: 12,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.18)",
          color: "rgba(255,255,255,.92)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Signals: <b>Price</b>, <b>Volume</b>, <b>News</b> (render-only)
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Next: plug in time window + real series</div>
      </div>
    </section>
  );
}
