/**
 * VF/Health/HealthStrip (spec §6.1/§2.3) — Core · Speech · Mic.
 * Re-checks on mount + when the panel becomes visible (no stale "ready").
 */
import { useCallback, useEffect, useState } from "react";
import { copy } from "../ui/copy";

type DotState = "checking" | "ok" | "bad";

interface Health {
  core: DotState;
  speech: DotState;
  speechDetail: string;
  mic: DotState;
  micDetail: string;
}

async function fetchCoreUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get(["coreUrl"]);
  return (stored.coreUrl as string) || "http://localhost:8020";
}

async function checkHealth(): Promise<Health> {
  const base = await fetchCoreUrl();
  const health: Health = {
    core: "checking",
    speech: "checking",
    speechDetail: "",
    mic: "checking",
    micDetail: "",
  };
  try {
    const res = await fetch(`${base}/api/v1/health`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { sttBackend?: string; status?: string };
    health.core = data.status === "ok" ? "ok" : "bad";
    health.speech = data.sttBackend && data.sttBackend !== "off" ? "ok" : "bad";
    health.speechDetail = data.sttBackend || "off";
  } catch {
    health.core = "bad";
    health.speech = "bad";
    health.speechDetail = copy("error.core.title");
  }
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    health.mic = status.state === "granted" ? "ok" : status.state === "denied" ? "bad" : "checking";
    health.micDetail = status.state;
  } catch {
    health.mic = "checking";
    health.micDetail = "unavailable";
  }
  return health;
}

export function HealthStrip() {
  const [health, setHealth] = useState<Health | null>(null);

  const refresh = useCallback(() => {
    setHealth((prev) => prev ?? { core: "checking", speech: "checking", speechDetail: "", mic: "checking", micDetail: "" });
    void checkHealth().then(setHealth);
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const items: { label: string; state: DotState; title: string }[] = health
    ? [
        { label: "Core", state: health.core, title: health.core },
        { label: "Speech", state: health.speech, title: health.speechDetail },
        { label: "Mic", state: health.mic, title: health.micDetail },
      ]
    : [];

  return (
    <div
      aria-label="Service health"
      style={{
        display: "flex",
        gap: 12,
        padding: "6px 12px",
        fontSize: 12,
        color: "var(--vf-text-secondary)",
        alignItems: "center",
      }}
    >
      {!health && <span>{copy("setup.health_check")}</span>}
      {items.map((it) => (
        <span
          key={it.label}
          className="vf-pill"
          title={it.title}
          style={{ padding: "2px 8px" }}
        >
          <span
            className={`vf-dot ${it.state === "ok" ? "ok" : it.state === "bad" ? "bad" : "busy"}`}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
