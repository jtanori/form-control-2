/**
 * Structured JSON logger (INFR-002) — same shape as core/lib/logging_config.py:
 * `{ts, level, component, sessionId, message, ...extra}`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  withSession(sessionId: string | null | undefined): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function emit(
  level: LogLevel,
  component: string,
  sessionId: string | null | undefined,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    component,
    sessionId: sessionId ?? null,
    message,
    ...(extra ?? {}),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export function createLogger(
  component: string,
  sessionId?: string | null,
): Logger {
  const sid = sessionId ?? null;
  const log =
    (level: LogLevel) =>
    (message: string, extra?: Record<string, unknown>) =>
      emit(level, component, sid, message, extra);
  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    withSession(next) {
      return createLogger(component, next);
    },
  };
}
