/**
 * B-3 UI — passive form registry list (pre-populated, no icon click needed).
 * Selection is lifted to the workspace (Start-voice gating, D10).
 */
import { useCallback, useEffect, useState } from "react";
import type { FormSummary } from "@shared/types";

async function send<T>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export interface FormListProps {
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  /** readiness hint for the workspace (forms seen at least once) */
  onFormsSeen?: (count: number) => void;
}

export function FormList({ activeKey, onSelect, onFormsSeen }: FormListProps) {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await send<{ ok: boolean; forms?: FormSummary[] }>({
        type: "GET_FORM_REGISTRY",
      });
      if (res.ok && res.forms) {
        setForms(res.forms);
        onFormsSeen?.(res.forms.length);
      } else setError(res.ok ? "" : "Could not read forms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registry unavailable");
    }
  }, [onFormsSeen]);

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

  const select = useCallback(
    async (key: string) => {
      const next = key === activeKey ? null : key;
      onSelect(next);
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
          await chrome.tabs
            .sendMessage(tab.id, {
              type: "SET_CUES",
              forms: all.map((f) => ({ ...f })),
              activeKey: next,
            })
            .catch(() => undefined);
        }
      } catch {
        /* cue paint is best-effort */
      }
    },
    [activeKey, onSelect],
  );

  return (
    <section
      aria-label="Detected forms"
      style={{
        margin: "0 12px",
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
        <span>Detected forms</span>
        <span className="vf-pill">
          <span className={`vf-dot ${error ? "bad" : forms.length ? "ok" : ""}`} />
          {error || (forms.length ? `${forms.length} found` : "scanning…")}
        </span>
      </div>
      {forms.length === 0 && !error && (
        <div style={{ fontSize: 12, color: "var(--vf-text-secondary)" }}>
          No forms found on this page — open a page with a form.
        </div>
      )}
      {forms.map((f) => (
        <button
          key={f.key}
          type="button"
          className={`vf-btn${activeKey === f.key ? " primary" : ""}`}
          style={{ justifyContent: "space-between", width: "100%" }}
          onClick={() => void select(f.key)}
          aria-pressed={activeKey === f.key}
        >
          <span>{f.title}</span>
          <span style={{ opacity: 0.75 }}>{f.fieldCount} fields</span>
        </button>
      ))}
    </section>
  );
}
