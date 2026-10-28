/**
 * B-2 — popup demoted to quick entry: launch workspace, help, last status.
 * Full runtime flow (forms, transcript, cards, Confirm) lives in the Side Panel.
 */
import { useCallback, useEffect, useState } from "react";
import { createLogger } from "@shared/logger";

const log = createLogger("ext.popup");

async function send<T>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function MiniApp() {
  const [status, setStatus] = useState("");
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.session.get(["sessionId"]);
      setSessionId((stored.sessionId as string) ?? "");
      const st = await send<{ ok: boolean; coreUrl?: string }>({
        type: "GET_STATE",
        sessionId: "",
      });
      if (st.ok) setStatus(`Core: ${st.coreUrl ?? "localhost:8020"}`);
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
    <div className="app">
      <header>
        <h1>VoiceForm</h1>
        <span className="session" title={sessionId}>
          {sessionId ? `${sessionId.slice(0, 14)}…` : ""}
        </span>
      </header>

      <button type="button" className="vf-btn primary" onClick={() => void openWorkspace()}>
        Open workspace
      </button>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <button
          type="button"
          className="vf-btn"
          onClick={() => void chrome.runtime.openOptionsPage()}
          title="Setup, microphone, tutorial"
        >
          ? Setup & help
        </button>
        <span className="status">{status}</span>
      </div>
    </div>
  );
}
