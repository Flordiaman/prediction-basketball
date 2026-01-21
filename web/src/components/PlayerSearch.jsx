import { useEffect, useState } from "react";

export default function PlayerSearch({ onSelectPlayer }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) {
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const r = await fetch(
          `/api/nba/db/players/search?q=${encodeURIComponent(term)}&limit=25`
        );
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ marginBottom: 12 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search player (type at least 2 letters)…"
        style={{ width: "100%", padding: 10, borderRadius: 10 }}
      />

      {loading && <div style={{ paddingTop: 8 }}>Searching…</div>}

      {!loading && rows.length > 0 && (
        <div style={{ marginTop: 8, border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          {rows.map((p) => (
            <button
              key={p.person_id}
              onClick={() => {
                setQ("");
                setRows([]);
                onSelectPlayer(p);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 10,
                border: "none",
                borderBottom: "1px solid #eee",
                background: "white",
                cursor: "pointer",
              }}
            >
              {p.display_first_last || `${p.first_name} ${p.last_name}`}
              {p.team_abbreviation ? ` — ${p.team_abbreviation}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
