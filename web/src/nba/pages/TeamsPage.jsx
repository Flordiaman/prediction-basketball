import React, { useEffect, useState } from "react";
import { fetchTeams } from "../api/nbaApi";

export default function TeamsPage() {
  const [state, setState] = useState({ loading: true, err: null, data: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchTeams();
        if (!alive) return;
        setState({ loading: false, err: null, data });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, err: e.message || String(e), data: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 1000 }}>Teams</div>
      {state.loading && <p>Loading teams…</p>}
      {state.err && <p style={{ color: "#b00020" }}>Error: {state.err}</p>}
      {!state.loading && !state.err && (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12 }}>
{JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
