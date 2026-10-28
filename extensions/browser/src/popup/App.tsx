/**
 * EXT-004 — Voice capture & popup UI.
 * Records audio → TRANSCRIBE → PARSE → confirm/edit/cancel → EXECUTE.
 * Clarification flow via CLARIFY. Text fallback when STT is unavailable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Command, ParseResponse } from "@shared/types";
import { createLogger } from "@shared/logger";
import { FormList } from "../sidepanel/FormList";
import { HealthStrip } from "../sidepanel/HealthStrip";
import { copy } from "../ui/copy";

const log = createLogger("ext.popup");

type Phase = "idle" | "recording" | "transcribing" | "parsing" | "ready" | "clarifying" | "executing";

interface CommandDraft {
  command: Command;
  value: string;
}

interface AmbiguityInfo {
  message: string;
  candidates: { nodeId: string; label: string; displayLabel?: string }[];
  pendingCommand: Command | null;
}

async function sendMessage<T = Record<string, unknown>>(
  message: Record<string, unknown>,
): Promise<T & { ok: boolean; error?: string }> {
  return chrome.runtime.sendMessage(message) as Promise<
    T & { ok: boolean; error?: string }
  >;
}

async function getSessionId(): Promise<string> {
  const stored = await chrome.storage.session.get(["sessionId"]);
  if (stored.sessionId) return stored.sessionId as string;
  const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.session.set({ sessionId });
  return sessionId;
}

async function fetchCoreUrl(): Promise<string> {
  const state = await sendMessage<{ coreUrl?: string }>({ type: "GET_STATE", sessionId: "" });
  return state.coreUrl ?? "http://localhost:8020";
}

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"ok" | "error" | "">("");
  const [transcript, setTranscript] = useState("");
  const [drafts, setDrafts] = useState<CommandDraft[]>([]);
  const [parse, setParse] = useState<ParseResponse | null>(null);
  const [clarifyText, setClarifyText] = useState("");
  const [ambiguity, setAmbiguity] = useState<AmbiguityInfo | null>(null);
  const [coreUrl, setCoreUrl] = useState("http://localhost:8020");
  const [sessionId, setSessionId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [activeFormKey, setActiveFormKey] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      setSessionId(await getSessionId());
      setCoreUrl(await fetchCoreUrl());
    })();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const toDrafts = useCallback((commands: Command[]): CommandDraft[] =>
    commands.map((command) => ({ command, value: command.value ?? "" })), []);

  const applyParse = useCallback((result: ParseResponse) => {
    setParse(result);
    setDrafts(toDrafts(result.commands));
    if (result.needsClarification) {
      setPhase("clarifying");
      setStatus(result.clarificationQuestion ?? "Which one did you mean?");
      setStatusKind("");
    } else {
      setPhase("ready");
      setStatus(
        result.commands.length
          ? `${result.commands.length} command(s) ready`
          : "No commands matched",
      );
      setStatusKind(result.commands.length ? "ok" : "error");
    }
  }, [toDrafts]);

  /**
   * Side Panel context (B-2/spike #1): the panel is a durable extension
   * page — the mic prompt cannot dismiss it, and the grant made on the
   * options page is reused silently. Replaces the old Stage window.
   */
  const startRecording = useCallback(async () => {
    setStatus("");
    setStatusKind("");
    setTranscript("");
    setParse(null);
    setDrafts([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void finishRecording(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      log.info("recording started (side panel)", { sessionId });
    } catch (err) {
      setStatusKind("error");
      setStatus(
        err instanceof Error && /Permission|NotAllowed/i.test(err.message)
          ? "Microphone not allowed yet — open ? Setup and press Enable Voice Control."
          : `Mic unavailable: ${err instanceof Error ? err.message : "unknown"}. Type a command instead.`,
      );
      setPhase("idle");
    }
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setPhase("transcribing");
    setStatus("Transcribing…");
    setStatusKind("");
  }, []);

  const finishRecording = useCallback(
    async (blob: Blob) => {
      try {
        const tx = await sendMessage<{ transcript?: string }>({
          type: "TRANSCRIBE",
          blob,
          sessionId,
        });
        if (!tx.ok) throw new Error(tx.error ?? "transcription failed");
        const text = tx.transcript ?? "";
        if (!text) {
          setPhase("idle");
          setStatusKind("error");
          setStatus("No speech recognized — try again or type instead.");
          return;
        }
        setTranscript(text);
        await runParse(text);
      } catch (err) {
        setPhase("idle");
        setStatusKind("error");
        setStatus(
          err instanceof Error ? err.message : "Transcription failed — type instead.",
        );
      }
    },
    [sessionId],
  );

  const runParse = useCallback(
    async (text: string) => {
      setPhase("parsing");
      setStatus("Parsing…");
      setStatusKind("");
      setTranscript(text);
      try {
        const res = await sendMessage<ParseResponse>({
          type: "PARSE",
          sessionId,
          transcript: text,
        });
        if (!res.ok) throw new Error(res.error ?? "parse failed");
        applyParse(res as unknown as ParseResponse);
      } catch (err) {
        setPhase("idle");
        setStatusKind("error");
        setStatus(err instanceof Error ? err.message : "Parse failed");
      }
    },
    [sessionId, applyParse],
  );

  const onConfirm = useCallback(async () => {
    const commands = drafts
      .filter((d) => d.command.action !== "fill" || d.value !== "")
      .map((d) =>
        d.command.action === "fill"
          ? { ...d.command, value: d.value }
          : d.command,
      );
    setPhase("executing");
    setStatus("Executing…");
    setStatusKind("");
    setAmbiguity(null);
    try {
      const res = await sendMessage<{
        result?: {
          status: string;
          error?: string;
          executed?: Command[];
          candidates?: { nodeId: string; label?: string; displayLabel?: string }[];
        };
      }>({ type: "EXECUTE", sessionId, commands });
      if (!res.ok) throw new Error(res.error ?? "execute failed");
      const result = res.result;
      if (result?.status === "ambiguity") {
        // Executor refused to guess — let the user pick a candidate directly.
        // (Core has no pending clarification here; CLARIFY would 409.)
        const failed = commands[result.executed?.length ?? 0];
        setAmbiguity({
          message: result.error ?? "Ambiguous target — pick one:",
          candidates: (result.candidates ?? []).map((c) => ({
            nodeId: c.nodeId,
            label: c.label ?? c.displayLabel ?? c.nodeId,
            displayLabel: c.displayLabel,
          })),
          pendingCommand: failed ?? null,
        });
        setPhase("ready");
        setStatusKind("error");
        setStatus(result.error ?? "Ambiguous target — pick one below.");
        return;
      }
      if (result?.status === "error") {
        setPhase("ready");
        setStatus(result.error ?? "Execution error");
        setStatusKind("error");
        return;
      }
      setPhase("idle");
      setDrafts([]);
      setParse(null);
      setStatusKind("ok");
      setStatus(`Executed ${result?.executed?.length ?? commands.length} command(s)`);
      log.info("executed", { sessionId, count: result?.executed?.length });
    } catch (err) {
      setPhase("ready");
      setStatusKind("error");
      setStatus(err instanceof Error ? err.message : "Execute failed");
    }
  }, [drafts, sessionId]);

  const pickCandidate = useCallback(
    (nodeId: string, label: string) => {
      if (!ambiguity?.pendingCommand) return;
      const command: Command = {
        ...ambiguity.pendingCommand,
        target: { ...ambiguity.pendingCommand.target, nodeId, label },
      };
      setAmbiguity(null);
      setDrafts((prev) => {
        const next = prev.map((d) =>
          d.command === ambiguity.pendingCommand ||
          (d.command.action === command.action &&
            d.command.target.label === ambiguity.pendingCommand?.target.label)
            ? { ...d, command }
            : d,
        );
        // If the failed command wasn't in drafts (filtered), append it
        if (!next.some((d) => d.command.target.nodeId === nodeId)) {
          next.push({ command, value: command.value ?? "" });
        }
        return next;
      });
      setStatusKind("ok");
      setStatus(`Target set to ${label}`);
    },
    [ambiguity],
  );

  const onClarify = useCallback(async () => {
    if (!clarifyText.trim()) return;
    setStatus("Resolving…");
    setStatusKind("");
    try {
      const res = await sendMessage<ParseResponse>({
        type: "CLARIFY",
        sessionId,
        clarificationText: clarifyText.trim(),
      });
      if (!res.ok) throw new Error(res.error ?? "clarify failed");
      setClarifyText("");
      applyParse(res as unknown as ParseResponse);
    } catch (err) {
      setStatusKind("error");
      setStatus(err instanceof Error ? err.message : "Clarify failed");
    }
  }, [clarifyText, sessionId, applyParse]);

  const onCancel = useCallback(() => {
    setDrafts([]);
    setParse(null);
    setAmbiguity(null);
    setPhase("idle");
    setStatus("Cancelled");
    setStatusKind("");
  }, []);

  const onNav = useCallback(
    async (type: "NAV_NEXT" | "NAV_PREV" | "NAV_READ") => {
      try {
        const res = await sendMessage<{
          cursor?: { index: number; label: string; value?: string };
        }>({ type, sessionId });
        if (res.ok && res.cursor) {
          const { index, label, value } = res.cursor;
          setStatusKind("ok");
          setStatus(
            `[#${index}] ${label}${value ? ` = ${value}` : ""}`,
          );
        }
      } catch (err) {
        setStatusKind("error");
        setStatus(err instanceof Error ? err.message : "Navigation failed");
      }
    },
    [sessionId],
  );

  /** B-8 — toggle zen on the first page with a content script (PING probe). */
  const onZen = useCallback(async () => {
    setStatusKind("");
    setStatus("Opening reading mode…");
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "PING" });
          await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_ZEN" });
          setStatusKind("ok");
          setStatus("Reading mode toggled — Esc or Done to exit.");
          return;
        } catch {
          /* try next tab */
        }
      }
      setStatusKind("error");
      setStatus("No page with VoiceForm found — open a form tab first.");
    } catch (err) {
      setStatusKind("error");
      setStatus(err instanceof Error ? err.message : "Zen failed");
    }
  }, []);

  const saveCoreUrl = useCallback(async (url: string) => {
    setCoreUrl(url);
    await sendMessage({ type: "SET_CORE_URL", coreUrl: url });
  }, []);

  /** History nav (D11 adopt-lite): last commands from Core session state. */
  const onHistory = useCallback(async () => {
    setStatusKind("");
    setStatus("Loading history…");
    try {
      const res = await fetch(`${coreUrl}/api/v1/session/${sessionId}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`session -> ${res.status}`);
      const data = (await res.json()) as { history?: Command[] };
      const history = (data.history ?? []).slice(-5);
      if (!history.length) {
        setStatus("No commands in this session yet.");
        return;
      }
      setStatusKind("ok");
      setStatus(
        `History: ${history
          .map((h) => `${h.action} ${h.target.label ?? h.target.nodeId ?? ""}`)
          .join(" · ")}`,
      );
    } catch (err) {
      setStatusKind("error");
      setStatus(
        err instanceof Error
          ? `History unavailable (${err.message}) — ${copy("permission.manual")}`
          : "History unavailable",
      );
    }
  }, [coreUrl, sessionId]);

  const recordingLabel = useMemo(() => {
    if (phase !== "recording") return copy("voice.start").replace("...", "");
    const m = Math.floor(elapsed / 60);
    const s = String(elapsed % 60).padStart(2, "0");
    return `${copy("voice.stop")} ${m}:${String(s).padStart(2, "0")}`;
  }, [phase, elapsed]);

  const onFormSelect = useCallback((key: string | null) => {
    setActiveFormKey(key);
  }, []);

  return (
    <div className="app">
      <header>
        <h1>VoiceForm</h1>
        <span className="session" title={sessionId}>
          {sessionId.slice(0, 14)}…
        </span>
      </header>

      <HealthStrip />

      <FormList activeKey={activeFormKey} onSelect={onFormSelect} />

      {/* Spec §6.1 primary: Start voice — gated on a selected form (D10).
          Page-tap tap-to-talk remains a parallel entry (D10). */}
      <button
        type="button"
        className="vf-btn primary"
        style={{ width: "100%" }}
        disabled={phase !== "recording" && !activeFormKey}
        onClick={() =>
          phase === "recording" ? stopRecording() : void startRecording()
        }
        title={
          phase === "recording"
            ? copy("voice.stop")
            : activeFormKey
              ? "Speak a command for the selected form"
              : "Select a form first"
        }
      >
        {recordingLabel}
      </button>

      <div className="row" style={{ justifyContent: "center" }}>
        <button type="button" onClick={() => void onNav("NAV_PREV")} title="Previous field">
          ←
        </button>
        <button type="button" onClick={() => void onNav("NAV_NEXT")} title="Next field">
          →
        </button>
        <button type="button" onClick={() => void onNav("NAV_READ")} title="Read focused">
          🔊
        </button>
        <button
          type="button"
          className="vf-btn"
          style={{ padding: "6px 12px", minHeight: 32 }}
          onClick={() => void onZen()}
          title="Reading mode (zen) — Esc or Done to exit"
        >
          Zen
        </button>
      </div>

      <div className={`transcript${transcript ? "" : " empty"}`}>
        {transcript || "Start voice (select a form) — or type a command below…"}
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("typed");
          if (typeof value === "string" && value.trim()) void runParse(value.trim());
        }}
      >
        <input
          name="typed"
          placeholder="Type a command…"
          style={{ flex: 1, minWidth: 160 }}
          autoComplete="off"
        />
        <button type="submit" className="primary">
          Parse
        </button>
      </form>

      {ambiguity && ambiguity.candidates.length > 0 && (
        <div className="clarify">
          <p>
            <strong>Ambiguous:</strong> {ambiguity.message}
          </p>
          <div className="row">
            {ambiguity.candidates.map((c) => (
              <button
                key={c.nodeId}
                type="button"
                onClick={() => pickCandidate(c.nodeId, c.label)}
              >
                {c.displayLabel ?? c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "clarifying" && (
        <div className="clarify">
          <p>
            <strong>Clarification:</strong> {status}
          </p>
          <input
            value={clarifyText}
            onChange={(e) => setClarifyText(e.target.value)}
            placeholder="Your answer…"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onClarify();
            }}
          />
          <div className="actions">
            <button type="button" className="primary" onClick={() => void onClarify()}>
              Submit answer
            </button>
          </div>
        </div>
      )}

      {drafts.length > 0 && phase !== "clarifying" && (
        <>
          {drafts.map((draft, i) => (
            <div className="card" key={`${draft.command.action}-${i}`}>
              <div className="cmd-title">
                <span>
                  {draft.command.action} · {draft.command.target.label ?? draft.command.target.nodeId}
                </span>
                {draft.command.confirmRequired && (
                  <span className="badge warn">confirm</span>
                )}
              </div>
              {draft.command.action === "fill" && (
                <input
                  value={draft.value}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((p, j) => (j === i ? { ...p, value: e.target.value } : p)),
                    )
                  }
                  placeholder="value"
                />
              )}
            </div>
          ))}
          <div className="actions">
            <button type="button" className="danger" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => setDrafts(toDrafts(parse?.commands ?? []))}>
              Reset edit
            </button>
            <button
              type="button"
              className="primary"
              disabled={phase === "executing"}
              onClick={() => void onConfirm()}
            >
              Confirm
            </button>
          </div>
        </>
      )}

      <div className={`status ${statusKind}`}>{status}</div>

      {/* Spec §6.1 bottom nav: Settings (always); History adopt-lite (D11) */}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button
          type="button"
          className="vf-btn"
          style={{ flex: 1, minHeight: 36 }}
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          Settings
        </button>
        <button
          type="button"
          className="vf-btn"
          style={{ flex: 1, minHeight: 36 }}
          onClick={() => void onHistory()}
        >
          History
        </button>
      </div>

      <details>
        <summary>Core URL</summary>
        <input
          className="core-url"
          value={coreUrl}
          onChange={(e) => setCoreUrl(e.target.value)}
          onBlur={(e) => void saveCoreUrl(e.target.value.trim())}
        />
      </details>
    </div>
  );
}
