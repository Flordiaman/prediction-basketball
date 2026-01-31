import React from "react";
import { NavLink } from "react-router-dom";
import DataStatusPill from "./DataStatusPill";

const linkStyle = ({ isActive }) => ({
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 900,
  opacity: isActive ? 1 : 0.75,
  border: isActive ? "2px solid #333" : "2px solid transparent",
});

export default function NbaNav() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <NavLink to="/nba" style={linkStyle}>Home</NavLink>
      <NavLink to="/nba/games" style={linkStyle}>Games</NavLink>
      <NavLink to="/nba/players" style={linkStyle}>Players</NavLink>
      <NavLink to="/nba/teams" style={linkStyle}>Teams</NavLink>
      <NavLink to="/nba/picks" style={linkStyle}>Picks</NavLink>
      <div style={{ marginLeft: "auto" }}>
        <DataStatusPill />
      </div>
    </div>
  );
}
