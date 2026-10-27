import { describe, expect, it, beforeEach } from "vitest";
import { extractFormSnapshot } from "../src/content/context-extractor";

function mount(html: string): void {
  document.body.innerHTML = html;
}

describe("extractFormSnapshot (EXT-002)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.title = "Fixture";
  });

  it("emits contract-shaped nodes with b-prefix ids", () => {
    mount(`
      <form>
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" value="a@b.com" />
        <button type="submit">Submit billing</button>
      </form>
    `);
    const snap = extractFormSnapshot();
    expect(snap.source).toBe("dom");
    expect(snap.title).toBe("Fixture");
    expect(snap.nodes).toHaveLength(2);
    expect(snap.nodes[0].nodeId).toBe("b1");
    expect(snap.nodes[0].label).toBe("email address");
    expect(snap.nodes[0].type).toBe("input");
    expect(snap.nodes[0].value).toBe("a@b.com");
    expect(snap.nodes[0].actions).toEqual(["fill", "clear"]);
    expect(snap.nodes[0].rect).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
    expect(snap.nodes[1].label).toBe("submit billing");
    expect(snap.nodes[1].type).toBe("button");
    expect(snap.nodes[1].actions).toEqual(["click"]);
  });

  it("label fallback 1: closest label", () => {
    mount(`<label>Full name <input id="n" /></label>`);
    expect(extractFormSnapshot().nodes[0].label).toBe("full name");
  });

  it("label fallback 2: label[for]", () => {
    mount(`<label for="pw">Password</label><input id="pw" />`);
    expect(extractFormSnapshot().nodes[0].label).toBe("password");
  });

  it("label fallback 3: aria-label", () => {
    mount(`<input aria-label="Card number" />`);
    expect(extractFormSnapshot().nodes[0].label).toBe("card number");
  });

  it("label fallback 4: placeholder", () => {
    mount(`<input placeholder="you@example.com" />`);
    expect(extractFormSnapshot().nodes[0].label).toBe("you@example.com");
  });

  it("label fallback 5: name", () => {
    mount(`<input name="shipping_zip" />`);
    expect(extractFormSnapshot().nodes[0].label).toBe("shipping_zip");
  });

  it("label fallback 6: button textContent", () => {
    mount(`<button>Continue to payment</button>`);
    expect(extractFormSnapshot().nodes[0].label).toBe("continue to payment");
  });

  it("excludes hidden elements", () => {
    mount(`
      <input id="vis" name="visible" />
      <input id="hid" name="hidden" style="display:none" />
      <input id="vis2" name="shown" hidden />
    `);
    const labels = extractFormSnapshot().nodes.map((n) => n.label);
    expect(labels).toContain("visible");
    expect(labels).not.toContain("hidden");
    expect(labels).not.toContain("shown");
  });

  it("classifies checkboxes and selects", () => {
    mount(`
      <input type="checkbox" id="t" checked />
      <label for="t">I agree</label>
      <select id="c"><option value="us">US</option></select>
    `);
    const snap = extractFormSnapshot();
    const box = snap.nodes.find((n) => n.type === "checkbox");
    const sel = snap.nodes.find((n) => n.type === "select");
    expect(box?.checked).toBe(true);
    expect(box?.actions).toEqual(["check", "uncheck"]);
    expect(sel?.actions).toEqual(["click", "fill"]);
  });

  it("exercises all six label fallbacks in one page", () => {
    mount(`
      <label>One <input id="a" /></label>
      <label for="b">Two</label><input id="b" />
      <input aria-label="Three" />
      <input placeholder="Four" />
      <input name="five" />
      <button>Six</button>
    `);
    const labels = extractFormSnapshot().nodes.map((n) => n.label);
    expect(labels).toEqual(["one", "two", "three", "four", "five", "six"]);
  });
});
