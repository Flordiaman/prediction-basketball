import React, { useMemo, useState } from "react";

import VerbalView from "./VerbalView";
import VisualView from "./VisualView";
import BehaviorLayers from "./BehaviorLayers";
import useSlugData from "./useSlugData";

function getSlugFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("slug") || "test-slug";
}

export default function SlugPage() {
  const slug = useMemo(() => getSlugFromUrl(), []);

  const [mode, setMode] = useState("verbal");
  const { data, loading, error } = useSlugData(slug);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16 }}>Error loading slug.</div>;
  if (!data) return <div style={{ padding: 16 }}>No data.</div>;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{slug}</h1>

        <button onClick={() => setMode(mode === "verbal" ? "visual" : "verbal")}>
          Switch to {mode === "verbal" ? "Visual" : "Verbal"}
        </button>
      </header>

      <div style={{ marginTop: 12 }}>
        {mode === "verbal" ? (
          <VerbalView narrative={data.narrative} />
        ) : (
          <VisualView narrative={data.narrative} />
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <BehaviorLayers layers={data.behavior?.layers || []} />
      </div>
    </div>
  );
}
