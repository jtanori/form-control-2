import { beforeEach, describe, expect, it } from "vitest";
import { extractFormSnapshot } from "../src/content/context-extractor";
import { findFormByKey } from "../src/content/form-registry";

describe("selected form context", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="billing" style="position: fixed">
        <label for="email">Email</label><input id="email" name="email" value="a@example.test">
      </form>
      <form id="shipping" style="position: fixed">
        <label for="zip">ZIP code</label><input id="zip" name="zip" value="12345">
      </form>`;
  });

  it("resolves a selected form and extracts only its controls", () => {
    const form = findFormByKey("billing");
    expect(form?.id).toBe("billing");
    const snapshot = extractFormSnapshot(form ?? undefined);
    expect(snapshot.nodes.map((node) => node.displayLabel)).toEqual(["Email"]);
  });

  it("does not silently substitute another form when a selection goes stale", () => {
    expect(findFormByKey("removed-form")).toBeNull();
  });
});
