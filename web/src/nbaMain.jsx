import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Use the components you already have
import NbaDbPanel from "./components/NbaDbPanel.jsx";
import PlayerSearch from "./components/PlayerSearch.jsx";

function NbaPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>NBA Stats</h1>
        <span style={{ opacity: 0.7 }}>isolated page: /nba</span>
      </div>

      {/* Simple layout: DB panel + search */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Database / Import</h2>
          <NbaDbPanel />
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Player Search</h2>
          <PlayerSearch />
        </div>
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 13 }}>
        This page is separate from Polymarket. If Polymarket breaks, we revert ONLY NBA changes.
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NbaPage />
  </React.StrictMode>
);
