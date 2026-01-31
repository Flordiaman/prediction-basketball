// web/src/components/PlayerSearch.jsx
import React, { useEffect, useMemo, useState } from "react";

const styles = {
  wrap: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
  },
  titleRow: { display: "flex", alignItems: "baseline", gap: 10 },
  title: { fontSize: 16, fontWeight: 700 },
  hint: { fontSize: 12, opacity: 0.7 },
  inputRow: { display: "flex", gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.25)",
    color: "inherit",
    outline: "none",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
  },
  meta: { marginTop: 8, fontSize: 12, opacity: 0.75 },
  list: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    userSelect: "none",
  },
  rowName: { fontWeight: 600 },
  rowSub: { fontSize: 12, opacity: 0.7 },
};

function normalizeId(p) {
  return (
    p?.id ??
    p?.person_id ??
    p?.player_id ??
    p?.playerId ??
    p?.PLAYER_ID ??
    null
  );
}

function normalizeName(p) {
  return p?.person_name ?? p?.full_name ?? p?.name ?? "";
}

export default function PlayerSearch({
  onSelectPlayer,
  onGamesLoaded,
  fetchLastGames,
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function searchPlayers(term) {
    const res = await fetch(
      `/api/nba/db/players/search?q=${encodeURIComponent(term)}&limit=25`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json(); // returns array
  }

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    setErr("");

    if (term.length < 2) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const t = setTimeout(async () => {
      try {
        const data = await searchPlayers(term);
        if (cancelled) return;

        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || "Search failed");
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const uiMeta = useMemo(() => {
    if (err) return <div style={styles.meta}>❌ {err}</div>;
    if (loading) return <div style={styles.meta}>Searching…</div>;
    if (q.trim().length >= 2) return <div style={styles.meta}>{rows.length} results</div>;
    return <div style={styles.meta}>Type 2+ letters to search</div>;
  }, [err, loading, rows.length, q]);

  async function handleSelect(p) {
    const id = normalizeId(p);
    const name = normalizeName(p);

    console.log("CLICK PLAYER RAW", p);

    const selected = {
      id,
      person_id: p?.person_id ?? null,
      person_name: name,
      raw: p,
    };

    if (onSelectPlayer) onSelectPlayer(selected);

    if (onGamesLoaded && id && typeof fetchLastGames === "function") {
      try {
        const games = await fetchLastGames(id);
        onGamesLoaded(games);
      } catch (e) {
        console.warn("fetchLastGames failed", e);
      }
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.titleRow}>
        <div style={styles.title}>Search Players</div>
        <div style={styles.hint}>Type 2+ letters</div>
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players"
        />
        <button style={styles.btn} onClick={() => setQ("")}>
          Clear
        </button>
      </div>

      {uiMeta}

      {rows.length > 0 && (
        <div style={styles.list}>
          {rows.map((p) => {
            const id = normalizeId(p);
            const name = normalizeName(p);

            return (
              <div
                key={String(id ?? `${p?.person_name ?? "unknown"}-${p?.team_id ?? "na"}`)}
                style={styles.row}
                onClick={() => handleSelect(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSelect(p);
                }}
              >
                <div style={styles.rowName}>{name}</div>
                <div style={styles.rowSub}>{id ? `#${id}` : ""}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
