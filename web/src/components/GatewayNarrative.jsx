import React from "react";
import BehaviorLayers from "../slug/BehaviorLayers";

export default function GatewayNarrative() {
  // safe stub: no API calls, no dependencies
  const layers = [
    {
      id: "momentum",
      label: "Momentum",
      status: "rising",
      summary: "Trend strength is climbing. Treat as BUILDING until volume confirms.",
    },
    {
      id: "noise",
      label: "Noise",
      status: "watch",
      summary: "No confirmation spike yet. Don’t upgrade the story early.",
    },
  ];

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.18)",
      }}
    >
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.86)", marginBottom: 8 }}>
        Narrative (Behavior Layers)
      </div>

      <BehaviorLayers layers={layers} />
    </div>
  );
}
