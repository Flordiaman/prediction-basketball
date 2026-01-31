import React from "react";

export default function BehaviorLayers({ layers }) {
  if (!layers || layers.length === 0) {
    return <div style={{ opacity: 0.75 }}>No behavior layers.</div>;
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      {layers.map((layer) => (
        <div key={layer.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 800, letterSpacing: -0.2 }}>{layer.label}</div>
            <span style={pill}>{layer.status}</span>
          </div>

          <div style={{ marginTop: 8, opacity: 0.85 }}>{layer.summary}</div>

          {layer.metrics && Object.keys(layer.metrics).length > 0 && (
            <pre style={pre}>{JSON.stringify(layer.metrics, null, 2)}</pre>
          )}
        </div>
      ))}
    </section>
  );
}

const card = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.18)",
  color: "rgba(255,255,255,.92)",
};

const pill = {
  fontSize: 11,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)",
  opacity: 0.9,
};

const pre = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.04)",
  fontSize: 12,
  overflowX: "auto",
  color: "rgba(255,255,255,.82)",
};
