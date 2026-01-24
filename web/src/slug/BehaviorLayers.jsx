import React from "react";

function Pill({ text }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,.12)",
        background: "rgba(0,0,0,.03)",
      }}
    >
      {text}
    </span>
  );
}

export default function BehaviorLayers({ layers }) {
  if (!layers || layers.length === 0) {
    return <div style={{ padding: 12, opacity: 0.7 }}>No behavior layers.</div>;
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      {layers.map((layer) => (
        <div
          key={layer.id}
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,.10)",
            background: "white",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>{layer.label}</div>
            <Pill text={layer.status || "static"} />
          </div>

          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            {layer.summary || "—"}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Metrics: (placeholder)
          </div>
        </div>
      ))}
    </section>
  );
}
