import React from "react";
import { Link, useParams } from "react-router-dom";

import useSlugData from "../slug/useSlugData";
import VerbalView from "../slug/VerbalView";
import BehaviorLayers from "../slug/BehaviorLayers";
import VisualView from "../slug/VisualView";

export default function NarrativePage() {
  const { slug = "nba" } = useParams();
  const { data, loading, error } = useSlugData(slug);

  const narrative = data?.narrative || null;
  const layers = data?.behavior?.layers || [];
  const series = data?.series || null;

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#070810",
        color: "white",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        {/* ===== TOP NAV ===== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link to="/gateway" style={backLink}>
            ← Back to Gateway
          </Link>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/narrative/nba" style={chip}>nba</Link>
            <Link to="/narrative/lakers" style={chip}>lakers</Link>
            <Link to="/narrative/celtics" style={chip}>celtics</Link>
          </div>
        </div>

        {/* ===== HEADER ===== */}
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Narrative</h1>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            slug: <code>{slug}</code>
          </div>
        </div>

        {/* ===== STATES ===== */}
        {loading && <div style={{ opacity: 0.7 }}>Loading narrative…</div>}
        {error && <div style={{ color: "#ff6b6b" }}>Error: {error.message}</div>}

        {/* ===== CONTENT ===== */}
        {!loading && data && (
          <>
            <div style={card}>
              <VerbalView narrative={narrative} />
            </div>

            <div style={card}>
              <div style={cardTitle}>Behavior Layers</div>
              <BehaviorLayers layers={layers} />
            </div>

            <div style={card}>
              <div style={cardTitle}>Visual</div>
              <VisualView narrative={narrative} series={series} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===== STYLES ===== */

const card = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.03)",
};

const cardTitle = {
  fontSize: 13,
  opacity: 0.75,
  marginBottom: 8,
};

const backLink = {
  color: "rgba(255,255,255,.85)",
  textDecoration: "none",
  fontSize: 13,
};

const chip = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.9)",
  textDecoration: "none",
  fontSize: 12,
};
