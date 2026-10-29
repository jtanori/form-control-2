import { useEffect, useState } from "react";

type Category = {
  id: string;
  title: string;
  description: string;
};

/**
 * ManualTest – placeholder UI for the Manual‑Testing Suite.
 * It loads the test catalogue from `tests/manual/tests.json` (bundled with the extension)
 * and displays a simple index of categories.
 *
 * Future iterations will replace this with a drawer, instruction panels, PASS/FAIL console, etc.
 */
export function ManualTest() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = chrome.runtime.getURL("tests/manual/tests.json");
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setCategories(data.categories ?? []))
      .catch((e) => {
        console.error("Failed to load test catalogue", e);
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  return (
    <div className="manual-test-root" style={{ padding: "1rem", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1rem" }}>Manual Testing Suite</h1>
      {error && <p style={{ color: "red" }}>Error loading catalogue: {error}</p>}
      {categories.length === 0 && !error ? (
        <p>Loading test categories…</p>
      ) : (
        <ul className="test-index" style={{ listStyle: "none", padding: 0 }}>
          {categories.map((cat) => (
            <li key={cat.id} className="test-item" style={{ marginBottom: "1rem", borderBottom: "1px solid #ddd", paddingBottom: "0.5rem" }}>
              <strong>{cat.title}</strong>
              <p style={{ margin: "0.25rem 0 0" }}>{cat.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
