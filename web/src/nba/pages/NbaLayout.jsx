import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import NbaNav from "../components/NbaNav";

export default function NbaLayout() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 14px 70px" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {/* BACK TO HOME */}
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,.2)",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          ← Home
        </button>

        <div style={{ fontSize: 26, fontWeight: 1000 }}>
          Blurift • NBA
        </div>
      </div>

      {/* NBA NAV */}
      <div style={{ marginBottom: 16 }}>
        <NbaNav />
      </div>

      {/* PAGE CONTENT */}
      <div
        style={{
          border: "2px solid #e5e5e5",
          borderRadius: 18,
          padding: 16,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}
