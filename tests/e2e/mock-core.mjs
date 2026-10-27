/**
 * Stub Core for CI (INTE-001): /api/v1/parse, /api/v1/clarify,
 * /api/v1/health, /stt/transcribe — plus CORS for extension origins.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_CORE_PORT || 8020);

const parseResponse = {
  sessionId: "e2e-session",
  commands: [
    {
      action: "fill",
      target: { label: "email address" },
      value: "test@example.com",
    },
    {
      action: "click",
      target: { label: "submit billing" },
      confirmRequired: true,
    },
  ],
  needsClarification: false,
  clarificationQuestion: null,
  model: "mock-core-v1",
};

const sttResponse = {
  transcript: "fill the email address with test@example.com and click submit billing",
  language: "en",
  confidence: 0.95,
  duration_sec: 3.2,
};

function send(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-session-id",
    ...extraHeaders,
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }
  if (url.pathname === "/api/v1/health") {
    send(res, 200, {
      status: "ok",
      version: "0.0.0-mock",
      provider: "mock-core-v1",
      sessionBackend: "memory",
      sttBackend: "mock",
    });
    return;
  }
  if (url.pathname === "/api/v1/parse") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body = parseResponse;
      try {
        const parsed = JSON.parse(raw || "{}");
        if (parsed.sessionId) body = { ...parseResponse, sessionId: parsed.sessionId };
      } catch {
        /* keep canned body */
      }
      send(res, 200, body);
    });
    return;
  }
  if (url.pathname === "/api/v1/clarify") {
    send(res, 200, {
      sessionId: "e2e-session",
      commands: [],
      needsClarification: false,
      clarificationQuestion: null,
      model: "mock-core-v1",
    });
    return;
  }
  if (url.pathname === "/stt/transcribe" || url.pathname === "/transcribe") {
    send(res, 200, sttResponse);
    return;
  }
  send(res, 404, { detail: `mock-core: no route ${url.pathname}` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-core] listening on http://127.0.0.1:${PORT}`);
});
