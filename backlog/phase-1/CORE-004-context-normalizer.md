# CORE-004 — Context Normalizer (Bridge Adapter)

- **Phase:** 1 — The Brain: NLU, Ambiguity, Session (Week 1–2)
- **Track / Agent:** Agent A — Backend / AI
- **Priority:** P1
- **Status:** done (Phase 1 PR)
- **Depends on:** CONTRACT-001
- **Parallel with:** CORE-002, CORE-003
- **Critical path:** No
- **Milestone gates:** G2, G3, G4 (shared foundation)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/8
- **GitHub labels:** `backlog`, `phase-1`, `P1`, `agent-backend`
- **GitHub milestone:** Phase 1 — Core NLU

## Objective

One adapter so the parser always sees the same `FormSnapshot` shape no matter whether it came from the browser (DOM), Android (AccessibilityService), or desktop (UIA/vision).

## Specification

- **File:** `/core/adapters/normalizer.py`
- **Input:** raw `FormSnapshot` from any source (`source: "dom" | "accessibility" | "vision"`).
- **Transformations:**
  - **Label normalization:** lowercase, trim, collapse whitespace; strip decorative punctuation.
  - **Index assignment:** deterministic `nodeId` generation when a source omits one (prefix per source: `b#` browser, `a#` accessibility, `d#` desktop, `v#` vision).
  - **`rect` standardization:** pixels `{x, y, w, h}`; convert/clamp zero rects for offscreen nodes (flag them).
  - **Action inference:** ensure `actions[]` is populated from `type` per CONTRACT-001 defaults.
- **Output:** normalized `FormSnapshot` validating against `/contracts/v1/form-context.schema.json`.

## Acceptance criteria

- [x] 3 sources (DOM, Accessibility, desktop/vision fixtures) produce **identical normalized JSON** for the same logical form.
- [x] Normalized output passes `jsonschema` validation.
- [x] Unknown/missing label yields `label: ""` plus `nodeId`, never `null` (parser depends on this).

## Handoffs

- **Input ←** EXT-002 (DOM), AND-002 (accessibility), DES-002 (UIA), CONTRACT-001 (target shape).
- **Output →** CORE-001 (uniform parser input), CORE-003 (stores normalized snapshots).
- **Note:** Exempts upstream extractors from matching byte-for-byte — only this layer guarantees equivalence.
