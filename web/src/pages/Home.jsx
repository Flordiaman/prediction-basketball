import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-4xl font-bold">Blurift</h1>
        <p className="mt-3 text-white/70 max-w-xl">
          Sports data, prediction signals, and behavioral analysis — organized,
          fast, and honest about freshness.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/nba"
            className="px-5 py-2 rounded-xl bg-white text-black font-medium"
          >
            Open NBA
          </Link>
          <Link
            to="/slugs"
            className="px-5 py-2 rounded-xl border border-white/10 hover:bg-white/10"
          >
            Slug Analysis
          </Link>
          <Link
            to="/signal"
            className="px-5 py-2 rounded-xl border border-white/10 hover:bg-white/10"
          >
            Signal Feed
          </Link>
        </div>
      </section>

      {/* Sections */}
      <section className="grid md:grid-cols-3 gap-4">
        <Card
          title="NBA Control Room"
          desc="Games, players, teams, picks — with data freshness clearly labeled."
          to="/nba"
        />
        <Card
          title="Slug Analysis"
          desc="Market slugs, behavioral layers, narrative vs price action."
          to="/slugs"
        />
        <Card
          title="Signal Feed"
          desc="Live-ish signals, alerts, and model outputs."
          to="/signal"
        />
      </section>
    </div>
  );
}

function Card({ title, desc, to }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
    >
      <div className="font-semibold text-lg">{title}</div>
      <div className="mt-2 text-sm text-white/70">{desc}</div>
    </Link>
  );
}
