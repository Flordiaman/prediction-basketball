import React, { useEffect, useState } from "react";

export default function NbaDbPanel() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      const r = await fetch("/api/nba/info");
      if (!r.ok) throw new Error("info HTTP " + r.status);
      const j = await r.json();
      setInfo(j);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>NBA DB</h2>
        <button onClick={load} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,.2)", background: "white" }}>
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #e74c3c", borderRadius: 10 }}>
          <b>Error:</b> {err}
        </div>
      )}

      {!info ? (
        <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ opacity: 0.8 }}>
            <div><b>DB Path:</b> <code>{info.db_path || "(unknown)"}</code></div>
            <div style={{ marginTop: 6 }}><b>Counts:</b></div>
            <ul style={{ margin: "6px 0 0 18px" }}>
              <li>Teams: <b>{info.counts?.teams ?? "?"}</b></li>
              <li>Players: <b>{info.counts?.players ?? "?"}</b></li>
            </ul>
          </div>

          <div style={{ marginTop: 10, opacity: 0.7 }}>
            Next step is importing the GitHub dataset so Players isn’t 0.
          </div>
        </div>
      )}
    </div>
  );
}
