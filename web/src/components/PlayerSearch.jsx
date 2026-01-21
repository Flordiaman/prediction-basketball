import { useEffect, useMemo, useState } from "react";

export default function PlayerSearch({ onSelectPlayer }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      setErr("");

      if (term.length < 2) {
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const r = await fetch(
          `/api/nba/db/players/search?q=${encodeURIComponent(term)}&limit=25`
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setRows([]);
        setErr("Player search failed");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={styles.wrap}>
      <div style={styles.titleRow}>
        <div style={styles.title}>Search Players</div>
        <div style={styles.hint}>Type 2+ letters</div>
      </div>

      <div style={styles.inputRow}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="LeBron, Curry, Durant…"
          style={styles.input}
        />
        <button
          type="button"
          onClick={() => {
            setQ("");
            setRows([]);
            setErr("");
          }}
          disabled={!q}
          style={{
            ...styles.clearBtn,
            opacity: q ? 1 : 0.5,
            cursor: q ? "pointer" : "not-allowed",
          }}
        >
          Clear
        </button>
      </div>

      {loading && <div style={styles.meta}>Searching…</div>}
      {!loading && err && <div style={styles.err}>{err}</div>}
      {!loading && !err && canSearch && rows.length === 0 && (
        <div style={styles.meta}>No matches.</div>
      )}

      {rows.length > 0 && (
        <div style={styles.results}>
          {rows.map((p) => {
            const name =
              p.display_first_last || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
            return (
              <button
                key={p.person_id}
                type="button"
                onClick={() => {
                  setRows([]);
                  setErr("");
                  onSelectPlayer?.(p);
                }}
                style={styles.rowBtn}
              >
                <div style={styles.rowLeft}>
                  <div style={styles.rowName}>{name}</div>
                  <div style={styles.rowSub}>
                    {p.team_abbreviation ? p.team_abbreviation : "—"}
                    {p.person_id ? ` • ID ${p.person_id}` : ""}
                  </div>
                </div>
                <div style={styles.rowRight}>View</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#ffffff",
    padding: 12,
    marginBottom: 12,
  },
  titleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: 700, color: "#111827" },
  hint: { fontSize: 12, color: "#6b7280" },

  inputRow: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    outline: "none",
  },
  clearBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    color: "#111827",
  },

  meta: { marginTop: 8, fontSize: 12, color: "#6b7280" },
  err: { marginTop: 8, fontSize: 12, color: "#b91c1c" },

  results: {
    marginTop: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  rowBtn: {
    width: "100%",
    textAlign: "left",
    padding: 10,
    border: "none",
    borderBottom: "1px solid #f3f4f6",
    background: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  rowLeft: { display: "flex", flexDirection: "column", gap: 2 },
  rowName: { fontSize: 14, fontWeight: 700, color: "#111827" },
  rowSub: { fontSize: 12, color: "#6b7280" },
  rowRight: { fontSize: 12, color: "#2563eb", fontWeight: 700 },
};
