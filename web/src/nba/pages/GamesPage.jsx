import React, { useEffect, useState } from "react";
import { fetchGames } from "../api/nbaApi";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function GamesPage() {
  const [date, setDate] = useState(todayStr());
  const [state, setState] = useState({ loading: true, err: null, data: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, err: null, data: null });
    (async () => {
      try {
        const data = await fetchGames(date);
        if (!alive) return;
        setState({ loading: false, err: null, data });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, err: e.message || String(e), data: null });
      }
    })();
    return () => { alive = false; };
  }, [date]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 1000 }}>Games</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {state.loading && <p>Loading games…</p>}
      {state.err && <p style={{ color: "#b00020" }}>Error: {state.err}</p>}

      {!state.loading && !state.err && (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12 }}>
{JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
