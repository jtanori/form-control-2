# contracts/design — UX-002 landing zone

Generated design identity (Gemini + ChatGPT board, human-merged) lands here:

| File | Contents |
|---|---|
| `tokens.json` | color/type/space/radius/elevation/blur (light + dark) |
| `copy.json` | EN microcopy slots (permission, errors, confirm, onboarding) |
| `components.md` | component inventory + states |
| `screens.md` | surface blueprints (panel, options, cues, zen, Android) |
| `mechanics.md` | state machines, timing, chimes, failure paths |

Until assets arrive, extension UI uses hand-authored tokens in
`extensions/browser/src/ui/tokens.css` (UX-001 B-0). Implementation should
derive that file from `tokens.json` once UX-002 delivers.
