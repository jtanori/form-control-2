/**
 * B-3 UI — passive form registry list (pre-populated, no icon click needed).
 */
import { useCallback, useEffect, useState } from "react";
import type { FormSummary } from "@shared/types";

async function send<T>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function FormList() {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await send<{ ok: boolean; forms?: FormSummary[] }>({
        type: "GET_FORM_REGISTRY",
      });
      if (res.ok && res.forms) setForms(res.forms);
      else setError(res.ok ? "" : "Could not read forms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registry unavailable");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const select = useCallback(async (key: string) => {
    const next = key === activeKey ? null : key;
    setActiveKey(next);
    try {
      const res = await send<{ ok: boolean; forms?: FormSummary[] }>({
        type: "GET_FORM_REGISTRY",
      });
      const all = res.forms ?? [];
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id !== undefined) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SET_CUES",
          forms: all.map((f) => ({ ...f })),
          activeKey: next,
        }).catch(() => undefined);
      }
    } catch {
      /* cue paint is best-effort */
    }
  }, [activeKey]);

  return (
    <section
      aria-label="Detected forms"
      style={{
        margin: "10px 10px 0",
        background: "var(--vf-surface)",
        border: "1px solid var(--vf-hairline)",
        borderRadius: "var(--vf-radius-card)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <span>Forms on this page</span>
        <span className="vf-pill">
          <span className={`vf-dot ${error ? "bad" : forms.length ? "ok" : ""}`} />
          {error || (forms.length ? `${forms.length} found` : "scanning…")}
        </span>
      </div>
      {forms.length === 0 && !error && (
        <div className="hint" style={{ fontSize: 12, color: "var(--vf-text-secondary)" }}>
          Detected automatically as you browse — no button needed.
        </div>
      )}
      {forms.map((f) => (
        <button
          key={f.key}
          type="button"
          className={`vf-btn${activeKey === f.key ? " primary" : ""}`}
          style={{ justifyContent: "space-between", width: "100%" }}
          onClick={() => void select(f.key)}
        >
          <span>{f.title}</span>
          <span style={{ opacity: 0.75 }}>{f.fieldCount} fields</span>
        </button>
      ))}
    </section>
  );
}
