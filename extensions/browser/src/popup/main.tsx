import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MiniApp } from "./MiniApp";
import "./popup.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");
createRoot(el).render(
  <StrictMode>
    <MiniApp />
  </StrictMode>,
);
