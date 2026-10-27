import { describe, expect, it, beforeEach } from "vitest";
import type { Command, FormSnapshot } from "@shared/types";
import {
  executeCommands,
  matchTarget,
  similarity,
} from "../src/content/executor";
import { navNext, navPrev, resetCursor } from "../src/content/cursor";

function snapshot(nodes: FormSnapshot["nodes"]): FormSnapshot {
  return {
    source: "dom",
    capturedAt: new Date().toISOString(),
    title: "T",
    nodes,
  };
}

function node(
  nodeId: string,
  label: string,
  type: FormSnapshot["nodes"][number]["type"] = "input",
): FormSnapshot["nodes"][number] {
  return {
    nodeId,
    label,
    displayLabel: label.replace(/\b\w/g, (c) => c.toUpperCase()),
    type,
    rect: { x: 0, y: 0, w: 100, h: 20 },
    source: "dom",
    actions: type === "input" ? ["fill", "clear"] : ["click"],
  };
}

describe("similarity", () => {
  it("is 1 for identical strings", () => {
    expect(similarity("Submit", "submit")).toBe(1);
  });
  it("scores near-matches high", () => {
    expect(similarity("submit billing", "submit billin")).toBeGreaterThan(0.85);
  });
  it("scores unrelated strings low", () => {
    expect(similarity("email", "password")).toBeLessThan(0.5);
  });
});

describe("matchTarget (EXT-003)", () => {
  const ctx = snapshot([
    node("b1", "email address"),
    node("b5", "submit billing", "button"),
    node("b6", "submit shipping", "button"),
  ]);

  it("resolves by exact nodeId first", () => {
    const m = matchTarget({ action: "click", target: { nodeId: "b6", label: "submit" } }, ctx);
    expect(m.status).toBe("ok");
    expect(m.node?.nodeId).toBe("b6");
  });

  it("returns ambiguity for two similar labels — never guesses", () => {
    const m = matchTarget({ action: "click", target: { label: "submit" } }, ctx);
    expect(m.status).toBe("ambiguity");
    expect(m.candidates?.map((c) => c.nodeId)).toEqual(["b5", "b6"]);
  });

  it("picks the unique high-similarity match", () => {
    const m = matchTarget({ action: "fill", target: { label: "email address" } }, ctx);
    expect(m.status).toBe("ok");
    expect(m.node?.nodeId).toBe("b1");
  });
});

describe("executeCommands (EXT-003)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetCursor();
  });

  it("refuses ambiguous submit without clicking", async () => {
    document.body.innerHTML = `
      <button id="sb">Submit billing</button>
      <button id="ss">Submit shipping</button>
    `;
    const ctx = snapshot([
      node("b5", "submit billing", "button"),
      node("b6", "submit shipping", "button"),
    ]);
    const commands: Command[] = [{ action: "click", target: { label: "submit" } }];
    const result = await executeCommands(commands, ctx);
    expect(result.status).toBe("ambiguity");
    expect(result.executed).toHaveLength(0);
    expect(result.candidates).toHaveLength(2);
  });

  it("fills an input with input+change events", async () => {
    document.body.innerHTML = `<input id="e" />`;
    const ctx = snapshot([node("b1", "email address")]);
    let inputSeen = false;
    let changeSeen = false;
    document.getElementById("e")!.addEventListener("input", () => (inputSeen = true));
    document.getElementById("e")!.addEventListener("change", () => (changeSeen = true));

    const result = await executeCommands(
      [{ action: "fill", target: { nodeId: "b1" }, value: "a@b.com" }],
      ctx,
    );
    expect(result.status).toBe("ok");
    expect((document.getElementById("e") as HTMLInputElement).value).toBe("a@b.com");
    expect(inputSeen).toBe(true);
    expect(changeSeen).toBe(true);
  });

  it("clicks a button", async () => {
    document.body.innerHTML = `<button id="go">Go</button>`;
    let clicked = false;
    document.getElementById("go")!.addEventListener("click", () => (clicked = true));
    const ctx = snapshot([node("b2", "go", "button")]);
    const result = await executeCommands(
      [{ action: "click", target: { nodeId: "b2" } }],
      ctx,
    );
    expect(result.status).toBe("ok");
    expect(clicked).toBe(true);
  });

  it("checks and unchecks checkboxes", async () => {
    document.body.innerHTML = `<input type="checkbox" id="c" />`;
    const ctx = snapshot([node("b3", "i agree", "checkbox")]);
    const el = document.getElementById("c") as HTMLInputElement;

    await executeCommands([{ action: "check", target: { nodeId: "b3" } }], ctx);
    expect(el.checked).toBe(true);

    await executeCommands([{ action: "uncheck", target: { nodeId: "b3" } }], ctx);
    expect(el.checked).toBe(false);
  });

  it("fills a select by value", async () => {
    document.body.innerHTML = `
      <select id="s">
        <option value="us">US</option>
        <option value="ca">CA</option>
      </select>
    `;
    const ctx = snapshot([node("b4", "country", "select")]);
    const result = await executeCommands(
      [{ action: "fill", target: { nodeId: "b4" }, value: "ca" }],
      ctx,
    );
    expect(result.status).toBe("ok");
    expect((document.getElementById("s") as HTMLSelectElement).value).toBe("ca");
  });

  it("clears an input", async () => {
    document.body.innerHTML = `<input id="e" value="x" />`;
    const ctx = snapshot([node("b1", "email address")]);
    await executeCommands([{ action: "clear", target: { nodeId: "b1" } }], ctx);
    expect((document.getElementById("e") as HTMLInputElement).value).toBe("");
  });

  it("navigate next clicks the matched next button", async () => {
    document.body.innerHTML = `<button id="n">Next</button>`;
    let clicked = false;
    document.getElementById("n")!.addEventListener("click", () => (clicked = true));
    const ctx = snapshot([node("b9", "next", "button")]);
    const result = await executeCommands(
      [{ action: "navigate", target: { nodeId: "b9", label: "next" } }],
      ctx,
    );
    expect(result.status).toBe("ok");
    expect(clicked).toBe(true);
  });

  it("stops at first error and keeps executed prefix", async () => {
    document.body.innerHTML = `<input id="e" />`;
    const ctx = snapshot([node("b1", "email address")]);
    const commands: Command[] = [
      { action: "fill", target: { nodeId: "b1" }, value: "ok@x.com" },
      { action: "click", target: { label: "no-such-button" } },
    ];
    const result = await executeCommands(commands, ctx);
    expect(result.status).toBe("error");
    expect(result.executed).toHaveLength(1);
  });
});

describe("virtual cursor (EXT-005)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input name="f1" />
      <input name="f2" />
      <input name="f3" />
    `;
    resetCursor();
  });

  it("advances and wraps around", () => {
    const ctx = snapshot([
      node("b1", "f1"),
      node("b2", "f2"),
      node("b3", "f3"),
    ]);
    expect(navNext(ctx).index).toBe(1);
    expect(navNext(ctx).index).toBe(2);
    expect(navNext(ctx).index).toBe(0); // wrap
    expect(navPrev(ctx).index).toBe(2); // wrap back
  });

  it("read returns current node label", () => {
    const ctx = snapshot([node("b1", "email address")]);
    const r = navNext(ctx); // moves to 0 first when index starts 0? ensureState starts index 0, navNext goes to 1
    // start fresh: index 0, navNext -> 1; with 1 node wraps to 0
    expect(r.label.toLowerCase()).toContain("email");
  });
});
