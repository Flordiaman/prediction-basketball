// web/src/pages/PageIndex.jsx
import React from "react";
import { Link } from "react-router-dom";

const LINKS = [
  { to: "/nba", label: "NBA" },
  { to: "/predict", label: "Predict" },
  { to: "/gateway", label: "Gateway" },
];

export default function PageIndex() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Blurift Pages</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        If it’s not listed here, it’s not a real page.
      </p>

      <ul style={{ lineHeight: 1.9 }}>
        {LINKS.map((x) => (
          <li key={x.to}>
            <Link to={x.to}>{x.label}</Link> <span style={{ opacity: 0.6 }}>{x.to}</span>
          </li>
        ))}
      </ul>

      <hr style={{ margin: "20px 0" }} />

      <p style={{ opacity: 0.8 }}>
        Add/remove links here as we confirm pages.
      </p>
    </div>
  );
}
