/**
 * B-2 / spec §6.5 — mini popup = launcher only: mic → Side Panel, form count, setup.
 */
import { useCallback, useEffect, useState } from "react";
import { createLogger } from "@shared/logger";
import { copy } from "../ui/copy";
import { countRegisteredForms, type FormRegistryEntry } from "../sidepanel/registry-utils";

const log = createLogger("ext.popup");

async function send<T>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function MiniApp() {
  const [status, setStatus] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [formCount, setFormCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.session.get(["sessionId"]);
      setSessionId((stored.sessionId as string) ?? "");
      const st = await send<{ ok: boolean; coreUrl?: string }>({
        type: "GET_STATE",
        sessionId: "",
      });
      if (st.ok) setStatus(`Core: ${st.coreUrl ?? "localhost:8020"}`);
      try {
        const reg = await send<{ ok: boolean; forms?: FormRegistryEntry[] }>({
          type: "GET_FORM_REGISTRY",
        });
        if (reg.ok) setFormCount(countRegisteredForms(reg.forms ?? []));
      } catch {
        /* count optional */
      }
    })();
  }, []);

  const openWorkspace = useCallback(async () => {
    try {
      await send({ type: "OPEN_SIDE_PANEL" });
      window.close();
    } catch (err) {
      log.warn("open side panel failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setStatus("Could not open workspace — use the toolbar panel icon.");
    }
  }, []);

  return (
    <div className="app" style={{ minWidth: 280, maxWidth: 320 }}>
      <header>
        <h1>VoiceForm</h1>
        <span className="session" title={sessionId}>
          {sessionId ? `${sessionId.slice(0, 14)}…` : ""}
        </span>
      </header>

      {/* §6.5 primary: mic routes to the Side Panel — popup never records here */}
      <button
        type="button"
        className="vf-btn primary"
        style={{ width: "100%" }}
        onClick={() => void openWorkspace()}
        title={copy("voice.start")}
      >
        🎤 {copy("voice.start").replace("...", "")}
      </button>

      <button
        type="button"
        className="vf-btn"
        style={{ width: "100%" }}
        onClick={() => void openWorkspace()}
      >
        {formCount === null
          ? "Detected forms"
          : formCount > 0
            ? `Detected forms · ${formCount}`
            : "Detected forms · none yet"}
      </button>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <button
          type="button"
          className="vf-btn"
          onClick={() => void chrome.runtime.openOptionsPage()}
          title="Setup, microphone, tutorial"
        >
          ? Setup
        </button>
        <span className="status">{status}</span>
      </div>
    </div>
  );
}
