/**
 * B-3 UI — passive form registry list (pre-populated, no icon click needed).
 * Registry data is per-tab; never mix forms/rectangles from different pages.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormSummary } from "@shared/types";
import { formsForTab, type FormRegistryEntry } from "./registry-utils";

async function send<T>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export interface FormListProps {
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  disabled?: boolean;
  /** readiness hint for the workspace (forms seen at least once) */
  onFormsSeen?: (count: number) => void;
}

export function FormList({ activeKey, onSelect, onFormsSeen, disabled = false }: FormListProps) {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [error, setError] = useState("");
  const activeTabRef = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const previousTabId = activeTabRef.current;
      const tabChanged = previousTabId !== tab?.id;
      activeTabRef.current = tab?.id;
      if (tabChanged && previousTabId !== undefined) {
        await chrome.tabs.sendMessage(previousTabId, { type: "CLEAR_CUES" }).catch(() => undefined);
      }
      const res = await send<{ ok?: boolean; forms?: FormRegistryEntry[] }>({
        type: "GET_FORM_REGISTRY",
      });
      const currentForms = formsForTab(res.forms ?? [], tab?.id);
      setForms(currentForms);
      setError(res.ok === false ? "Could not read forms" : "");
      onFormsSeen?.(currentForms.length);

      // The side panel can remain open while the active tab changes. Drop a
      // selection that belongs to the previous page rather than leaving voice
      // enabled with a stale form key.
      const selectionMissing = Boolean(
        activeKey && !currentForms.some((form) => form.key === activeKey),
      );
      if (tabChanged || selectionMissing) onSelect(null);
      if (tabChanged || selectionMissing) {
        if (tab?.id !== undefined) {
          await chrome.tabs.sendMessage(tab.id, {
            type: "SET_CUES",
            forms: currentForms,
            activeKey: null,
          }).catch(() => undefined);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registry unavailable");
    }
  }, [activeKey, onFormsSeen, onSelect]);

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
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id === undefined) return;
        const res = await send<{ forms?: FormRegistryEntry[] }>({
          type: "GET_FORM_REGISTRY",
        });
        const currentForms = formsForTab(res.forms ?? [], tab.id);
        await chrome.tabs
          .sendMessage(tab.id, {
            type: "SET_CUES",
            forms: currentForms,
            activeKey: next,
          })
          .catch(() => undefined);
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
          disabled={disabled}
        >
          <span>{f.title}</span>
          <span style={{ opacity: 0.75 }}>{f.fieldCount} fields</span>
        </button>
      ))}
    </section>
  );
}
