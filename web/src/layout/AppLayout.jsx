import { Outlet } from "react-router-dom";
import TopTabs from "../components/TopTabs";


export default function AppLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <TopTabs />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
