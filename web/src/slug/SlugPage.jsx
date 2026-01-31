import React, { useMemo, useState } from "react";

import PlayerTrends from "../components/PlayerTrends";
import VerbalView from "./VerbalView";
import VisualView from "./VisualView";
import BehaviorLayers from "./BehaviorLayers";
import useSlugData from "./useSlugData";

function getSlugFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("slug") || "test-slug";
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: active
          ? "2px solid rgba(0,0,0,.45)"
          : "1px solid rgba(0,0,0,.14)",
        background: active ? "white" : "rgba(0,0,0,.02)",
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

<div style={{ padding: 12, borderRadius: 12, background: "yellow", fontWeight: 900 }}>
  DEBUG: SlugPage.jsx UPDATED ✅
</div>


export default function SlugPage() {
  const slug = useMemo(() => getSlugFromUrl(), []);
  const [mode, setMode] = useState("verbal");

  const { data, loading, error } = useSlugData(slug);

  if (loading)
    return <div style={{ padding: 16, fontFamily: "system-ui" }}>Loading…</div>;
  if (error)
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        Error loading slug.
      </div>
    );
  if (!data)
    return <div style={{ padding: 16, fontFamily: "system-ui" }}>No data.</div>;

  return (
    <div
      style={{
        fontFamily: "system-ui",
        background: "#f6f7fb",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Slug</div>
            <h1 style={{ margin: 0, fontSize: 32, letterSpacing: -0.6 }}>
              {slug}
            </h1>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              asOf: <code>{data.asOf}</code>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ModeButton
              active={mode === "verbal"}
              onClick={() => setMode("verbal")}
            >
              Verbal
            </ModeButton>
            <ModeButton
              active={mode === "visual"}
              onClick={() => setMode("visual")}
            >
              Visual
            </ModeButton>
          </div>
        </div>

        {/* Main layout */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          {/* Left: content */}
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: "white",
              boxShadow: "0 6px 18px rgba(0,0,0,.06)",
              border: "1px solid rgba(0,0,0,.06)",
            }}
          >
            {mode === "verbal" ? (
              <>
                <VerbalView narrative={data.narrative} />
                <div style={{ marginTop: 12 }}>
                  <PlayerTrends />
                </div>
              </>
            ) : (
              <>
                <VisualView narrative={data.narrative} />
                <div style={{ marginTop: 12 }}>
                  <PlayerTrends />
                </div>
              </>
            )}
          </div>

          {/* Right: behavior */}
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: "white",
              boxShadow: "0 6px 18px rgba(0,0,0,.06)",
              border: "1px solid rgba(0,0,0,.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16 }}>Behavior</h2>
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                rule:{" "}
                <code>{data.behavior?.ruleVersion || "—"}</code>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <BehaviorLayers layers={data.behavior?.layers || []} />
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Visual is a shell. We plug metrics + rules later without changing the
          contract.
        </div>
      </div>
    </div>
  );
}
