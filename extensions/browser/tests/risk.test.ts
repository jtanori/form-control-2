import { describe, expect, it } from "vitest";
import type { Command } from "@shared/types";
import { isRisky } from "../src/background/risk";

const click = (label: string): Command => ({
  action: "click",
  target: { label },
});

describe("confirmation risk classification", () => {
  it.each(["Submit billing", "Pay now", "Place order", "Checkout", "Delete account", "Sign in"]) (
    "marks consequential click labels as risky: %s",
    (label) => expect(isRisky([click(label)])).toBe(true),
  );

  it("does not gate ordinary edits unless the parser marks them consequential", () => {
    const fill: Command = { action: "fill", target: { label: "email" }, value: "a@b.test" };
    expect(isRisky([fill])).toBe(false);
    expect(isRisky([{ ...fill, confirmRequired: true }])).toBe(true);
  });
});
