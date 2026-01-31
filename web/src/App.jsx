import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Gateway from "./pages/Gateway";
import NarrativePage from "./pages/NarrativePage";

import NbaPage from "./pages/nba/NbaPage";
import SlugPage from "./slug/SlugPage";
import NbaDbPanel from "./components/NbaDbPanel";
import NotFound from "./pages/NotFound";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/gateway" element={<Gateway />} />

      {/* Narrative */}
     <Route path="/narrative/:slug" element={<NarrativePage />} />


      {/* NBA */}
      <Route path="/nba/*" element={<NbaPage />} />

      {/* Slug engine (existing) */}
      <Route path="/slug/:slug" element={<SlugPage />} />

      {/* Tools */}
      <Route path="/db" element={<NbaDbPanel />} />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

