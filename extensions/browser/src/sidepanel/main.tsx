/**
 * Side Panel workspace entry (B-2 / spec §6.1).
 * Order: header → health → forms → Start voice (gated, D10) → command area → nav.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ManualTest } from "./ManualTest";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");
createRoot(el).render(
  <StrictMode>
    <ManualTest />
  </StrictMode>,
);
