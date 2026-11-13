import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@ledger/ui/styles.css";
import { App } from "./App";

const host = document.getElementById("root");
if (host === null) throw new Error("élément #root introuvable");
createRoot(host).render(<StrictMode><App /></StrictMode>);
