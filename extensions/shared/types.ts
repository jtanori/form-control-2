/**
 * Shared types for contracts/v1 (CONTRACT-001).
 * Source of truth remains the JSON schemas; keep these in sync by hand for MVP.
 */

export type NodeType = "input" | "button" | "checkbox" | "select" | "link";

export type NodeAction =
  | "fill"
  | "click"
  | "check"
  | "uncheck"
  | "navigate"
  | "clear";

export type CommandAction = NodeAction;

export type Source = "dom" | "accessibility" | "vision";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormNode {
  nodeId: string;
  label: string;
  displayLabel?: string;
  type: NodeType;
  value?: string;
  checked?: boolean;
  rect: Rect;
  offscreen?: boolean;
  role?: string;
  source: Source;
  actions: NodeAction[];
}

export interface FormSnapshot {
  sessionId?: string;
  source: Source;
  capturedAt: string;
  title: string;
  url?: string;
  nodes: FormNode[];
}

export interface CommandTarget {
  label?: string;
  nodeId?: string;
  index?: number;
  rect?: Rect;
}

export interface Command {
  action: CommandAction;
  target: CommandTarget;
  value?: string;
  confirmRequired?: boolean;
}

export interface ClarificationRequest {
  sessionId: string;
  question: string;
  candidates: FormNode[];
  previousTranscript?: string;
  ambiguity?: string;
}

export interface ParseResponse {
  sessionId: string;
  commands: Command[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  clarification: ClarificationRequest | null;
  model?: string | null;
}

export interface ClarifyResponse extends ParseResponse {}

export interface SessionState {
  sessionId: string;
  currentContextSnapshot: FormSnapshot | null;
  history: Command[];
  currentActiveNodeId?: string;
  formSteps: string[];
}

export interface ExecutionResult {
  status: "ok" | "ambiguity" | "error";
  executed: Command[];
  candidates?: FormNode[];
  error?: string;
}

/** B-3 Tier 1 — passive form discovery entry (local, extension-side only). */
export interface FormSummary {
  key: string;
  title: string;
  fieldCount: number;
  rect: Rect | null;
  formIndex: number;
}

/** Message contract between popup ↔ background ↔ content (EXT-004/006). */
export type ExtensionMessage =
  | { type: "TRANSCRIBE"; blob: Blob; sessionId: string }
  | {
      type: "PARSE";
      sessionId: string;
      transcript: string;
      context?: FormSnapshot | null;
      tabId?: number;
    }
  | {
      type: "EXECUTE";
      sessionId: string;
      commands: Command[];
      context?: FormSnapshot | null;
      tabId?: number;
    }
  | {
      type: "CLARIFY";
      sessionId: string;
      clarificationText: string;
      context?: FormSnapshot | null;
      tabId?: number;
    }
  | { type: "GET_CONTEXT"; sessionId: string; tabId?: number }
  | { type: "NAV_NEXT" | "NAV_PREV" | "NAV_READ"; sessionId: string; tabId?: number }
  | { type: "SET_CORE_URL"; coreUrl: string; sessionId?: string }
  | { type: "GET_STATE"; sessionId: string }
  | { type: "FORM_REGISTRY"; forms: FormSummary[]; href: string; tabId?: number }
  | { type: "GET_FORM_REGISTRY" }
  | { type: "OPEN_SIDE_PANEL" }
  | { type: "OPEN_OPTIONS" };
