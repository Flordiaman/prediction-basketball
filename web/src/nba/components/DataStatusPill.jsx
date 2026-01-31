import React, { useEffect, useState } from "react";
import { fetchStatus } from "../api/nbaApi";

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

export default function DataStatusPill() {
  const [state, setState] = useState({ loading: true, err: null, status: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const status = await fetchStatus();
        if (!alive) return;
        setState({ loading: false, err: null, status });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, err: e.message || String(e), status: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading) return <span style={pillStyle("#999")}>Status…</span>;
  if (state.err) return <span style={pillStyle("#b00020")}>Status error</span>;

  const last = state.status?.lastUpdatedUtc || state.status?.lastUpdated || null;
  if (!last) return <span style={pillStyle("#999")}>No timestamp</span>;

  const lastDt = new Date(last);
  const now = new Date();
  const ageDays = daysBetween(now, lastDt);
  const isOld = ageDays > 7;

  return (
    <span style={pillStyle(isOld ? "#b00020" : "#0a7d00")}>
      {isOld ? "OLD" : "FRESH"} • updated {lastDt.toLocaleString()}
    </span>
  );
}

function pillStyle(borderColor) {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    border: `2px solid ${borderColor}`,
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.4,
    userSelect: "none",
  };
}
