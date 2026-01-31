import React, { useEffect, useState } from "react";
import { fetchPlayers } from "../api/nbaApi";

export default function PlayersPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState({ loading: false, err: null, data: null });

  async function runSearch() {
    setState({ loading: true, err: null, data: null });
    try {
      const data = await fetchPlayers(q);
      setState({ loading: false, err: null, data });
    } catch (e) {
      setState({ loading: false, err: e.message || String(e), data: null });
    }
  }

  useEffect(() => { runSearch(); }, []);

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Players</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player…"
          style={{ padding: 10, borderRadius: 12, border: "2px solid #ddd", minWidth: 260 }}
        />
        <button onClick={runSearch} style={btnStyle}>Search</button>
      </div>

      {state.loading && <p>Loading players…</p>}
      {state.err && <p style={{ color: "#b00020" }}>Error: {state.err}</p>}

      {!state.loading && !state.err && (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12 }}>
{JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "2px solid #333",
  fontWeight: 900,
  cursor: "pointer",
};
