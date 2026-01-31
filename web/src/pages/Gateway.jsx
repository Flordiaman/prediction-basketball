// src/pages/Gateway.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GatewayNarrative from "../components/GatewayNarrative";





/**
 * Blurift Gateway (Frontend Landing)
 * - Verbal-first vibe
 * - Marquee clipped correctly
 * - NBA is opened as a STANDALONE package (new tab), never Render
 */



function useNowTicker(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function Pill({ children, tone = "neutral" }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    letterSpacing: ".2px",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.86)",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  const toneStyle =
    tone === "positive"
      ? { borderColor: "rgba(53,208,127,.35)", background: "rgba(53,208,127,.08)" }
      : tone === "caution"
      ? { borderColor: "rgba(255,199,0,.35)", background: "rgba(255,199,0,.08)" }
      : tone === "negative"
      ? { borderColor: "rgba(255,77,109,.35)", background: "rgba(255,77,109,.08)" }
      : null;

  return <span style={{ ...base, ...(toneStyle || {}) }}>{children}</span>;
}

function GlowButton({ href, children, kind = "primary", target, rel }) {
  const btn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    textDecoration: "none",
    fontSize: 14,
    letterSpacing: ".2px",
    border: "1px solid rgba(255,255,255,.10)",
    transition: "transform .18s ease, background .18s ease, border-color .18s ease",
    userSelect: "none",
  };

  const primary = {
    background: "linear-gradient(135deg, rgba(98,126,255,.35), rgba(53,208,127,.18))",
    color: "rgba(255,255,255,.95)",
    boxShadow: "0 18px 40px rgba(0,0,0,.35)",
  };

  const ghost = {
    background: "rgba(255,255,255,.03)",
    color: "rgba(255,255,255,.88)",
  };

  const style = kind === "primary" ? { ...btn, ...primary } : { ...btn, ...ghost };

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      style={style}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.22)";
        e.currentTarget.style.background =
          kind === "primary"
            ? "linear-gradient(135deg, rgba(98,126,255,.45), rgba(53,208,127,.22))"
            : "rgba(255,255,255,.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.10)";
        e.currentTarget.style.background =
          kind === "primary"
            ? "linear-gradient(135deg, rgba(98,126,255,.35), rgba(53,208,127,.18))"
            : "rgba(255,255,255,.03)";
      }}
    >
      {children}
      <span style={{ opacity: 0.85 }}>→</span>
    </a>
  );
}

function FeatureCard({ title, desc, icon, tone = "neutral" }) {
  const card = {
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
    boxShadow: "0 16px 40px rgba(0,0,0,.28)",
    position: "relative",
    overflow: "hidden",
  };

  const glow =
    tone === "positive"
      ? "radial-gradient(520px 220px at 0% 0%, rgba(53,208,127,.18), transparent 60%)"
      : tone === "caution"
      ? "radial-gradient(520px 220px at 0% 0%, rgba(255,199,0,.14), transparent 60%)"
      : tone === "negative"
      ? "radial-gradient(520px 220px at 0% 0%, rgba(255,77,109,.14), transparent 60%)"
      : "radial-gradient(520px 220px at 0% 0%, rgba(98,126,255,.14), transparent 60%)";

  return (
    <div style={card}>
      <div style={{ position: "absolute", inset: 0, background: glow, pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(0,0,0,.18)",
              color: "rgba(255,255,255,.9)",
              fontSize: 16,
            }}
          >
            {icon}
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,.92)", letterSpacing: ".2px" }}>{title}</div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.72)" }}>{desc}</div>
      </div>
    </div>
  );
}

function MiniWave({ level = 62 }) {
  const w = 260;
  const h = 46;
  const points = useMemo(() => {
    const base = clamp(level, 0, 100) / 100;
    const arr = [];
    for (let i = 0; i < 32; i++) {
      const t = i / 31;
      const wiggle = Math.sin(t * Math.PI * 3) * 0.18 + Math.sin(t * Math.PI * 9) * 0.06;
      const v = clamp(base + wiggle, 0.05, 0.95);
      arr.push(v);
    }
    return arr;
  }, [level]);

  const pad = 4;
  const toX = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const toY = (v) => pad + (h - pad * 2) * (1 - v);

  const d = points
    .map((v, i) => {
      const x = toX(i);
      const y = toY(v);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,.80)" strokeWidth="2" />
    </svg>
  );
}

function Marquee() {
  const row = {
    display: "inline-flex",
    gap: 18,
    alignItems: "center",
    whiteSpace: "nowrap",
    fontSize: 12,
    color: "rgba(255,255,255,.70)",
    opacity: 0.95,
    animation: "blurift-marquee 18s linear infinite",
    willChange: "transform",
  };

  const item = (tone) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.10)",
    background:
      tone === "g"
        ? "rgba(53,208,127,.08)"
        : tone === "y"
        ? "rgba(255,199,0,.08)"
        : tone === "r"
        ? "rgba(255,77,109,.08)"
        : "rgba(255,255,255,.04)",
  });

  return (
    <div
      style={{
        overflow: "hidden",
        overflowX: "clip",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
        maxWidth: "100%",
        position: "relative",
        contain: "layout paint",
        isolation: "isolate",
        transform: "translateZ(0)",
      }}
    >
      <div style={row}>
        <span style={item("g")}>▲ Momentum rising</span>
        <span style={item("y")}>• Volume waiting</span>
        <span style={item("b")}>Signal clarity: 0.72</span>
        <span style={item("r")}>▼ Noise spike detected</span>
        <span style={item("b")}>Interpretation &gt; data dump</span>
        <span style={item("g")}>Regime shift watch</span>
        <span style={item("b")}>Words first. Visuals second.</span>
        <span style={item("y")}>Confidence changes only when metrics do</span>

        <span style={item("g")}>▲ Momentum rising</span>
        <span style={item("y")}>• Volume waiting</span>
        <span style={item("b")}>Signal clarity: 0.72</span>
        <span style={item("r")}>▼ Noise spike detected</span>
        <span style={item("b")}>Interpretation &gt; data dump</span>
        <span style={item("g")}>Regime shift watch</span>
        <span style={item("b")}>Words first. Visuals second.</span>
        <span style={item("y")}>Confidence changes only when metrics do</span>
      </div>
    </div>
  );
}

export default function Gateway() {
  const navigate = useNavigate();
  const now = useNowTicker(1000);
  const [pulse, setPulse] = useState(72);
  const rafRef = useRef(null);

  useEffect(() => {
    let t0 = performance.now();
    const tick = (t) => {
      const dt = (t - t0) / 1000;
      const v = 72 + Math.sin(dt * 1.1) * 8 + Math.sin(dt * 2.9) * 3;
      setPulse(clamp(Math.round(v), 58, 86));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, []);

  const page = {
    minHeight: "100vh",
    padding: "28px 16px 70px",
    background:
      "radial-gradient(1200px 700px at 15% 10%, rgba(98,126,255,.22), transparent 55%), radial-gradient(900px 520px at 85% 18%, rgba(53,208,127,.14), transparent 55%), radial-gradient(900px 520px at 30% 88%, rgba(255,199,0,.10), transparent 55%), linear-gradient(180deg, rgba(7,8,16,1) 0%, rgba(8,10,22,1) 50%, rgba(5,6,12,1) 100%)",
    color: "white",
    position: "relative",
    overflowX: "hidden",
  };

  const shell = { maxWidth: 1100, margin: "0 auto" };

  const glass = {
    border: "1px solid rgba(255,255,255,.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
    borderRadius: 22,
    boxShadow: "0 22px 60px rgba(0,0,0,.35)",
  };

  const topbar = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const dot = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(53,208,127,.85)",
    boxShadow: "0 0 0 6px rgba(53,208,127,.14)",
  };

  const hero = { marginTop: 18, padding: 22, ...glass };

  const laneGrid = {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  };

  const micro = {
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.18)",
    display: "grid",
    gap: 10,
  };

  return (
    <div style={page}>
      <style>{`
        @keyframes blurift-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes blurift-float {
          0% { transform: translateY(0px); opacity: .72; }
          50% { transform: translateY(-10px); opacity: .95; }
          100% { transform: translateY(0px); opacity: .72; }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.75,
          filter: "blur(.2px)",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 6 + (i % 3) * 2,
              height: 6 + (i % 3) * 2,
              borderRadius: 999,
              left: `${(i * 9 + 6) % 92}%`,
              top: `${(i * 13 + 6) % 92}%`,
              background:
                i % 3 === 0
                  ? "rgba(98,126,255,.55)"
                  : i % 3 === 1
                  ? "rgba(53,208,127,.45)"
                  : "rgba(255,199,0,.40)",
              animation: `blurift-float ${6 + (i % 5)}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <div style={shell}>
        <div style={{ ...glass, padding: "14px 16px" }}>
          <div style={topbar}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={dot} />
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 14, letterSpacing: ".4px", fontWeight: 600 }}>Blurift</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>verbal-first intelligence</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill tone="positive">LIVE</Pill>
              <Pill>Signal Strength: {pulse}</Pill>
              <Pill>{now.toLocaleTimeString()}</Pill>
            </div>
          </div>
        </div>

        <div style={hero}>
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr .65fr", gap: 16 }}>
            <div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>Interpretation engine</Pill>
                <Pill tone="caution">Noise filter</Pill>
                <Pill tone="positive">Behavior-led</Pill>
              </div>

              <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "12px 0 0", letterSpacing: ".2px" }}>
                Movement → Meaning.
                <br />
                <span style={{ color: "rgba(255,255,255,.86)" }}>Words first. Visuals when they earn it.</span>
              </h1>

              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.74)", maxWidth: 680 }}>
                Blurift reads what’s changing, explains why it matters, and upgrades the narrative only when the metrics force a shift.
                <div style={{ marginTop: 8, color: "rgba(255,255,255,.88)" }}>
                  <strong>Price is the effect — behavior is the cause.</strong>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <GlowButton href="/" kind="primary">
                  Enter Signal Feed
                </GlowButton>

                <GlowButton href="/nba" kind="ghost" target="_blank" rel="noopener noreferrer">
                  NBA
                </GlowButton>
                 <GlowButton href="/narrative/nba" kind="ghost">
                  Narrative
                </GlowButton>



              </div>

              <div style={{ marginTop: 12 }}>
                <Marquee />
              </div>
            </div>

            <div style={micro}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.86)" }}>Live Signal Preview</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.62)" }}>updated now</div>
              </div>

              <MiniWave level={pulse} />

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,.88)" }}>
                  “Attention is clustering. If volume confirms, we treat this as a regime change — not noise.”
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone="positive">▲ momentum</Pill>
                  <Pill>confidence 0.72</Pill>
                  <Pill tone="caution">watch volume</Pill>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "rgba(255,255,255,.62)" }}>
                Blurift doesn’t spam charts. It speaks when there’s something real.
              </div>
            </div>
          </div>
        </div>

        <div style={laneGrid}>
          <FeatureCard icon="⚡" tone="positive" title="Signal Feed" desc="Your daily driver. Verbal-first signals that explain the move and the meaning." />
          <FeatureCard icon="🧠" tone="neutral" title="Interpretation Layer" desc="Narratives update only when the underlying metrics actually shift." />
          <FeatureCard icon="🧪" tone="caution" title="Signal Lab" desc="Define thresholds, confidence rules, and what counts as a real regime change." />
          <FeatureCard icon="🔎" tone="neutral" title="Explore" desc="Search and browse topics, entities, markets, or events — without drowning in noise." />
          <FeatureCard icon="🛡️" tone="negative" title="Noise Control" desc="Detect spikes, fakeouts, and thin follow-through. Blurift flags what’s not confirmed." />
          <FeatureCard icon="⚙️" tone="neutral" title="Settings" desc="Placeholder for now — no dead routes." />
        </div>

        <div style={{ marginTop: 16, padding: 16, ...glass }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,.92)" }}>Local-first links</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>
               NBA is part of this app. Use <strong>/nba</strong> to open the NBA pages.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <GlowButton href="/" kind="ghost">
                About
              </GlowButton>
              <GlowButton href="/" kind="ghost">
                Settings
              </GlowButton>
              <GlowButton href="/" kind="primary">
                Launch Feed
              </GlowButton>
            </div>
          </div>
        </div>

       
      </div>
    </div>
  );
}
