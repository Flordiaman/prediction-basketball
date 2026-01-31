import React from "react";
import { Link } from "react-router-dom";

function Card({ title, desc, to }) {
  return (
    <Link to={to} style={{
      display: "block",
      textDecoration: "none",
      color: "inherit",
      border: "2px solid #eee",
      borderRadius: 16,
      padding: 14,
      fontWeight: 800
    }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{title}</div>
      <div style={{ opacity: 0.8, fontWeight: 600 }}>{desc}</div>
    </Link>
  );
}

export default function NbaHome() {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>
        Control room.
      </div>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Everything NBA: games, players, teams, picks. Data older than 7 days is OLD.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <Card title="Games" desc="Today + date picker" to="/nba/games" />
        <Card title="Players" desc="Search + trends" to="/nba/players" />
        <Card title="Teams" desc="Team dashboards" to="/nba/teams" />
        <Card title="Picks" desc="Your model outputs" to="/nba/picks" />
      </div>
    </div>
  );
}
