import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-xl font-semibold">Page not found</div>
      <Link to="/" className="inline-block mt-3 underline text-white/80">
        Back to Home
      </Link>
    </div>
  );
}
