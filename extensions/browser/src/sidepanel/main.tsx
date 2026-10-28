/**
 * Side Panel workspace entry (B-2 / spec §6.1).
 * Order: header → health → forms → Start voice (gated, D10) → command area → nav.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../popup/App";
import "../popup/popup.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
