# EXT-002 — DOM Explorer / Form Context Extractor

- **Phase:** 2 — Browser Bridge (Week 2–3)
- **Track / Agent:** Agent B — Extension / Frontend
- **Priority:** P0
- **Status:** ready
- **Depends on:** EXT-001, CONTRACT-001
- **Parallel with:** EXT-003 (executor interface), EXT-004, EXT-005
- **Critical path:** Yes
- **Milestone gates:** G3

## Objective

Extract a `FormSnapshot` from any page with high label accuracy — the input the whole NLU pipeline reasons over.

## Specification

- **File:** `/extensions/browser/src/content/context-extractor.ts`
- **Export:** `extractFormSnapshot(root?: HTMLElement): FormSnapshot`
- **Traverse:** `document.querySelectorAll('input, textarea, select, button, a[href], [role="button"], [role="checkbox"], [role="textbox"]')`
- **Filter hidden:** `offsetParent === null || getComputedStyle(el).visibility === 'hidden'`
- **Label resolution order (exact):**
  1. `element.closest('label')?.textContent?.trim()`
  2. `document.querySelector('label[for="' + element.id + '"]')?.textContent`
  3. `element.getAttribute('aria-label')`
  4. `element.getAttribute('placeholder')`
  5. `element.getAttribute('name')`
  6. `element.textContent?.trim()` (buttons/links)
- **Build array:** each node gets `nodeId: "b2"` (browser-prefixed index), `label`, `type`, `value`, `checked`, `rect` (via `getBoundingClientRect()`), `tagName`, `actions` (per CONTRACT-001 defaults).
- **Shadow DOM:** MVP does **not** pierce deep; if element is in a shadow root and `document.querySelector` fails, log a warning (INFR-002) and skip.

## Acceptance criteria

- [ ] On 5 reference forms (React, Bootstrap, plain HTML, Material — fixtures under `/tests/fixtures/`), outputs JSON with **>95% label accuracy**.
- [ ] Output validates against `/contracts/v1/form-context.schema.json`.
- [ ] Hidden elements excluded; all 6 label fallbacks exercised by unit tests.

## Handoffs

- **Input ←** EXT-001 (content script), CONTRACT-001 (FormSnapshot).
- **Output →** EXT-003 (matching context), EXT-005 (node index), EXT-006 (`context` for PARSE), CORE-004 (normalizes).
- **Contract:** Same logical form as AND-002/DES-002 must normalize identically in CORE-004.
