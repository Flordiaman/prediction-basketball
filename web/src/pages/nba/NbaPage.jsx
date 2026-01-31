import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import NbaDbPanel from "../../components/NbaDbPanel.jsx";
import NbaTrendsPage from "../../components/NbaTrendsPage.jsx";

function pill(active) {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(255,255,255,.35)" : "1px solid rgba(255,255,255,.14)",
    background: active ? "rgba(125, 60, 60, 0.1)" : "rgba(0,0,0,.18)",
    color: "rgba(255,255,255,.92)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
  };
}

export default function NbaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("trends");
 // default to the cool page

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(255,255,255,.08)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ← Home
          </button>

          <div>
            <h1 style={{ margin: 0 }}>Blurift — NBA</h1>
            <div style={{ opacity: 0.75, fontSize: 13 }}>Player search + last games + trends</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={pill(tab === "numbers")} onClick={() => setTab("numbers")}>
            Numbers
          </button>
          <button style={pill(tab === "trends")} onClick={() => setTab("trends")}>
            Trends + Analysis
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === "numbers" ? <NbaDbPanel /> : <NbaTrendsPage />}
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 13 }}>
        This page is separate from Polymarket. If Polymarket breaks, we revert ONLY NBA changes.
      </div>
    </div>
  );
}
