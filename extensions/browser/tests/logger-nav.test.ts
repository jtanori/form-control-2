import { describe, expect, it } from "vitest";
import { createLogger, setLogLevel } from "@shared/logger";
import { navMessageForLabel } from "../src/background/navigation";

describe("logger (INFR-002 TS)", () => {
  it("emits the same JSON shape as core", () => {
    setLogLevel("debug");
    const lines: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => lines.push(msg);
    try {
      createLogger("ext.test", "sess-1").info("hello", { commandCount: 2 });
    } finally {
      console.log = orig;
      setLogLevel("info");
    }
    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0]);
    expect(payload).toMatchObject({
      level: "info",
      component: "ext.test",
      sessionId: "sess-1",
      message: "hello",
      commandCount: 2,
    });
    expect(typeof payload.ts).toBe("string");
  });
});

describe("navigation mapping (EXT-005)", () => {
  it("maps next/back/read labels", () => {
    expect(navMessageForLabel("Next field")).toBe("NAV_NEXT");
    expect(navMessageForLabel("go back")).toBe("NAV_PREV");
    expect(navMessageForLabel("previous button")).toBe("NAV_PREV");
    expect(navMessageForLabel("read email")).toBe("NAV_READ");
    expect(navMessageForLabel("submit order")).toBeNull();
  });
});
