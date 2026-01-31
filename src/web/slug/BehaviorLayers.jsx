export default function BehaviorLayers({ layers }) {
  if (!layers || layers.length === 0) {
    return <div style={{ color: "rgba(255,255,255,.72)" }}>No behavior layers.</div>;
  }

  const wrap = { display: "grid", gap: 10 };
  const item = {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.90)",
  };
  const titleRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
  const label = { fontSize: 13, fontWeight: 700, letterSpacing: ".2px" };
  const statusPill = (status) => ({
    fontSize: 11,
    padding: "4px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.14)",
    background:
      status === "rising"
        ? "rgba(53,208,127,.14)"
        : status === "watch"
        ? "rgba(255,199,0,.14)"
        : status === "falling"
        ? "rgba(255,77,109,.14)"
        : "rgba(255,255,255,.08)",
    color: "rgba(255,255,255,.88)",
    textTransform: "uppercase",
    letterSpacing: ".6px",
    whiteSpace: "nowrap",
  });
  const summary = { marginTop: 6, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,.72)" };

  return (
    <section style={wrap}>
      {layers.map((layer) => (
        <div key={layer.id} style={item}>
          <div style={titleRow}>
            <div style={label}>{layer.label}</div>
            <div style={statusPill(layer.status)}>{layer.status}</div>
          </div>
          <div style={summary}>{layer.summary}</div>
        </div>
      ))}
    </section>
  );
}
