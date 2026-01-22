import React, { useEffect, useState } from "react";
import NbaDbPanel from "./components/NbaDbPanel.jsx";
import PlayerSearch from "./components/PlayerSearch.jsx";

export default function NbaApp() {
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        const h = await fetch("/api/nba/health");
        if (!h.ok) throw new Error("health HTTP " + h.status);
        const j = await h.json();
        if (alive) setHealth(j);
      } catch (e) {
        if (alive) setErr(e?.message || String(e));
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>NBA</h1>
        {health ? (
          <span style={{ padding: "6px 10px", border: "1px solid #2ecc71", borderRadius: 999 }}>
            NBA API OK
          </span>
        ) : (
          <span style={{ opacity: 0.7 }}>Checking API…</span>
        )}
        <span style={{ opacity: 0.6 }}>(/nba — isolated from Polymarket)</span>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e74c3c", borderRadius: 12 }}>
          <b>Error:</b> {err}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }}>
        <NbaDbPanel />
        <PlayerSearch />
      </div>
    </div>
  );
}
