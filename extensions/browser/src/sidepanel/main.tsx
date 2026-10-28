/**
 * B-2 — Side Panel workspace entry.
 * Same React tree as the (former) popup app + B-3 form registry list.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../popup/App";
import { FormList } from "./FormList";
import "../ui/tokens.css";
import "../popup/popup.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");
createRoot(el).render(
  <StrictMode>
    <FormList />
    <App />
  </StrictMode>,
);
