/** Mount point: React 19, one root, the shared stylesheet, nothing else. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@ledger/ui/styles.css";
import { App } from "./App";

const host = document.getElementById("root");
if (host === null) throw new Error("élément #root introuvable dans index.html");

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);