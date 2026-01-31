// src/pagesRegistry.js
export const PAGES = [
  {
    id: "home",
    label: "Home",
    path: "/",
    description: "Navigation hub",
    showOnHome: false,
  },
  {
    id: "nba",
    label: "NBA Data",
    path: "/nba",
    description: "Professional basketball stats and tools",
    showOnHome: true,
  },
  {
    id: "markets",
    label: "Prediction Markets",
    path: "/markets",
    description: "Market search, saved slugs, and snapshots",
    showOnHome: true,
  },
  {
    id: "behavior",
    label: "Behavior Board",
    path: "/behavior",
    description: "Verbal-first narrative + visual toggle",
    showOnHome: true,
  },
];
