import { useEffect, useState } from "react";

export default function useSlugData(slug) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/narrative/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (e.name === "AbortError") return;
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug]);

  return { data, loading, error };
}
