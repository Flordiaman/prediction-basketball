import { useEffect, useMemo, useState } from "react";

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Badge({ children, variant = "neutral" }) {
  const base = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    opacity: 0.95,
    marginLeft: 8,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };

  const styles =
    variant === "live"
      ? { background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" }
      : variant === "scheduled"
      ? { background: "#e0f2fe", borderColor: "#bae6fd", color: "#075985" }
      : variant === "final"
      ? { background: "#dcfce7", borderColor: "#bbf7d0", color: "#166534" }
      : { background: "#f3f4f6", borderColor: "#e5e7eb", color: "#111827" };

  return <span style={{ ...base, ...styles }}>{children}</span>;
}

/** Some APIs return ISO date strings in weird places (including status). */
function isIsoDateString(v) {
  if (!v || typeof v !== "string") return false;
  // rough ISO check
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v.trim());
}

/** Normalize team fields across different shapes. */
function getTeams(g) {
  // BallDontLie typical:
  const v = g?.visitor_team || g?.away_team || g?.awayTeam || null;
  const h = g?.home_team || g?.homeTeam || null;

  // Your current UI earlier used g.away / g.home, so keep that too.
  const awayAbbr =
    v?.abbreviation ||
    v?.abbr ||
    g?.away_abbr ||
    g?.awayAbbr ||
    g?.away ||
    "AWAY";

  const homeAbbr =
    h?.abbreviation ||
    h?.abbr ||
    g?.home_abbr ||
    g?.homeAbbr ||
    g?.home ||
    "HOME";

  const awayName =
    v?.full_name ||
    (v?.city && v?.name ? `${v.city} ${v.name}` : null) ||
    g?.away_name ||
    g?.awayName ||
    null;

  const homeName =
    h?.full_name ||
    (h?.city && h?.name ? `${h.city} ${h.name}` : null) ||
    g?.home_name ||
    g?.homeName ||
    null;

  return { awayAbbr, homeAbbr, awayName, homeName };
}

/** Start time: prefer g.date, else if status is ISO use that. */
function getStartMs(g) {
  const raw = g?.date || (isIsoDateString(g?.status) ? g.status : null);
  const ms = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function getStatusBadge(g) {
  const statusRaw = String(g?.status ?? "").trim();
  const s = statusRaw.toUpperCase();

  // FINAL
  if (s.includes("FINAL")) return { label: "FINAL", variant: "final", detail: statusRaw };

  // LIVE signals (your screenshot showed "4th Qtr")
  const period = Number(g?.period ?? 0);
  const looksLive =
    period > 0 ||
    s.includes("QTR") ||
    s.includes("QUARTER") ||
    s.includes("HALF") ||
    s.includes("OT") ||
    s.includes("OVERTIME");

  if (looksLive) return { label: "LIVE", variant: "live", detail: statusRaw };

  return { label: "SCHEDULED", variant: "scheduled", detail: statusRaw };
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [teams, setTeams] = useState([]);
  const [todayGames, setTodayGames] = useState([]);
  const [todayDate, setTodayDate] = useState("");
  const [err, setErr] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [liveGames, setLiveGames] = useState([]);


useEffect(() => {
  let alive = true;

  async function load() {
    try {
      setErr("");

      const [h, t, g, live] = await Promise.all([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/teams").then((r) => r.json()),
        fetch("/api/games/today").then((r) => r.json()),
        fetch("/api/games/live").then((r) => r.json()),
      ]);

      if (!alive) return;

      setHealth(h);
      setTeams(t?.teams || t || []);
      setTodayDate(g?.date || "");
      setTodayGames(g?.games || g || []);
      setLiveGames(live?.events || []);
    } catch (e) {
      console.error(e);
      if (alive) setErr(String(e));
    }
  }

  load();
  const id = setInterval(load, 30_000);

  return () => {
    alive = false;
    clearInterval(id);
  };
}, []);


  const east = useMemo(() => teams.filter((t) => t.conference === "East"), [teams]);
  const west = useMemo(() => teams.filter((t) => t.conference === "West"), [teams]);

  const visibleGames = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();

    const filtered = q
      ? todayGames.filter((g) => {
          const { awayAbbr, homeAbbr, awayName, homeName } = getTeams(g);
          const hay = `${awayAbbr} ${homeAbbr} ${awayName ?? ""} ${homeName ?? ""}`.toLowerCase();
          return hay.includes(q);
        })
      : todayGames;

    // Sort by start time; if missing, keep at end.
    return [...filtered].sort((a, b) => {
      const ta = getStartMs(a);
      const tb = getStartMs(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta - tb;
    });
  }, [todayGames, teamQuery]);

  const todaysGamesTitle = useMemo(() => {
    const datePart = todayDate ? `(${todayDate})` : "";
    return `Today’s Games ${datePart} • ${visibleGames.length}`;
  }, [todayDate, visibleGames.length]);

  return (
    <div style={{ fontFamily: "system-ui", background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 40, letterSpacing: -0.5 }}>Basketball App</h1>
          {health && (
            <span style={{ fontSize: 14, opacity: 0.75 }}>
              API connected ✅ <Badge>{health.serverTime}</Badge>
            </span>
          )}
        </div>

        {err && (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <strong>Error:</strong> {err}
          </div>
        )}
<Card
  title={`Live Games • ${
    liveGames.filter((e) => e.status?.type?.state === "in").length
  }`}
>
  {liveGames.filter((e) => e.status?.type?.state === "in").length === 0 ? (
    <div style={{ opacity: 0.7 }}>No games live right now.</div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {liveGames
        .filter((e) => e.status?.type?.state === "in")
        .map((e) => {
          const comp = e.competitions?.[0];
          const teams = comp?.competitors || [];
          const away = teams.find((t) => t.homeAway === "away");
          const home = teams.find((t) => t.homeAway === "home");

          const awayAbbr = away?.team?.abbreviation || "AWAY";
          const homeAbbr = home?.team?.abbreviation || "HOME";
          const awayScore = away?.score ?? "-";
          const homeScore = home?.score ?? "-";

          const detail =
            e.status?.type?.shortDetail ||
            e.status?.type?.detail ||
            e.status?.type?.description ||
            "";

          return (
            <div
              key={e.id}
              style={{
                border: "1px solid #eef0f3",
                borderRadius: 12,
                padding: 12,
                background: "#fafbff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800 }}>
                  {awayAbbr} {awayScore} <span style={{ opacity: 0.6 }}>@</span>{" "}
                  {homeAbbr} {homeScore}
                </div>
                <Badge>LIVE</Badge>
              </div>
              {detail ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  {detail}
                </div>
              ) : null}
            </div>
          );
        })}
    </div>
  )}
</Card>


<div style={{ height: 12 }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <Card title={`East (${east.length})`}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {east.map((t) => (
                <li
                  key={t.abbr ?? t.abbreviation}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f1f3",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{t.abbr ?? t.abbreviation}</span>
                  <span style={{ opacity: 0.8 }}>
                    {t.city} {t.name}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={todaysGamesTitle}>
            <input
              value={teamQuery}
              onChange={(e) => setTeamQuery(e.target.value)}
              placeholder="Search teams (e.g., Bulls, CHI, Jazz)…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                marginBottom: 12,
              }}
            />

            {visibleGames.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No games found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibleGames.map((g) => {
                  const { awayAbbr, homeAbbr, awayName, homeName } = getTeams(g);
                  const badge = getStatusBadge(g);

                  const ms = getStartMs(g);
                  const timeLabel =
                    ms !== null
                      ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "";

                  return (
                    <div
                      key={g.id ?? `${awayAbbr}-${homeAbbr}-${ms ?? Math.random()}`}
                      style={{
                        border: "1px solid #eef0f3",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fafbff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 800 }}>
                          {awayAbbr} <span style={{ opacity: 0.6 }}>@</span> {homeAbbr}
                          {timeLabel ? (
                            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.7, fontWeight: 600 }}>
                              {timeLabel}
                            </span>
                          ) : null}
                        </div>

                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>

                      {(awayName || homeName || badge.detail) && (
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                          {(awayName || awayAbbr) + " vs " + (homeName || homeAbbr)}
                          {badge.detail ? <span style={{ marginLeft: 8, opacity: 0.65 }}>• {badge.detail}</span> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title={`West (${west.length})`}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {west.map((t) => (
                <li
                  key={t.abbr ?? t.abbreviation}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f1f3",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{t.abbr ?? t.abbreviation}</span>
                  <span style={{ opacity: 0.8 }}>
                    {t.city} {t.name}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>
          Tip: next we can add “click a game” → show players, box score, and charted trends.
        </div>
      </div>
    </div>
  );
}
