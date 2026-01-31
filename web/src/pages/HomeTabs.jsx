import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? "1px solid rgba(255,255,255,.35)" : "1px solid rgba(255,255,255,.14)",
        background: active ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.18)",
        color: "rgba(255,255,255,.92)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {children}
    </button>
  );
}

export default function HomeTabs() {
  const nav = useNavigate();

    // "Active pages" = your actual routes today
    const tabs = [
    { key: "home", label: "Home", go: "/" },
    { key: "nba", label: "NBA", go: "/nba" },
    { key: "gateway", label: "Gateway", go: "/gateway" },
    { key: "signal", label: "Signal", go: "/signal" },
    { key: "slugs", label: "Slugs", go: "/slugs" },
    ];


  const [active, setActive] = useState(tabs[0].key);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Blurift</h1>
      <div style={{ opacity: 0.75, fontSize: 13, marginTop: 6 }}>
        All active pages — one home.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {tabs.map((t) => (
          <TabBtn
            key={t.key}
            active={t.key === active}
            onClick={() => {
              setActive(t.key);
              nav(t.go);
            }}
          >
            {t.label}
          </TabBtn>
        ))}
      </div>

      <div style={{ marginTop: 16, opacity: 0.75, fontSize: 13 }}>
        Tip: these tabs jump to real routes (so URLs are shareable/bookmarkable).
      </div>
    </div>
  );
}
