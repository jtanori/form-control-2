import { describe, expect, it } from "vitest";
import type { FormSummary } from "@shared/types";
import { countRegisteredForms, formsForTab, type FormRegistryEntry } from "../src/sidepanel/registry-utils";

const form = (key: string): FormSummary => ({
  key,
  title: key,
  fieldCount: 2,
  rect: null,
  formIndex: 0,
});

const entries: FormRegistryEntry[] = [
  { tabId: 11, href: "https://one.test", forms: [form("checkout"), form("login")], at: 1 },
  { tabId: 22, href: "https://two.test", forms: [form("search")], at: 2 },
];

describe("per-tab form registry", () => {
  it("only returns forms owned by the active tab", () => {
    expect(formsForTab(entries, 11).map((item) => item.key)).toEqual(["checkout", "login"]);
    expect(formsForTab(entries, 22).map((item) => item.key)).toEqual(["search"]);
  });

  it("does not leak stale or cross-tab forms when there is no active tab entry", () => {
    expect(formsForTab(entries, 33)).toEqual([]);
    expect(formsForTab(entries, undefined)).toEqual([]);
  });

  it("counts forms, not registry entries", () => {
    expect(countRegisteredForms(entries)).toBe(3);
  });
});
