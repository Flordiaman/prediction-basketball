import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home" },
  { to: "/nba", label: "NBA" },
  { to: "/slugs", label: "Slugs" },
  { to: "/signal", label: "Signal" },
  { to: "/gateway", label: "Gateway" },
];


const base =
  "px-3 py-2 rounded-lg text-sm font-medium transition border border-transparent";
const active = "bg-white text-black border-gray-200 shadow-sm";
const inactive = "text-gray-200 hover:bg-white/10 hover:text-white";

export default function TopTabs() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-black/70 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <div className="mr-3 font-semibold text-white whitespace-nowrap">
          Blurift
        </div>

        <nav className="flex gap-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `${base} ${isActive ? active : inactive}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
