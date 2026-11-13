/** Entry point: mount the fund, load the shared stylesheet, no other side effect. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@ledger/ui/styles.css";
import { App } from "./App.js";

const container = document.getElementById("root");
if (container === null) throw new Error("index.html has no #root element");

createRoot(container).render(<StrictMode><App /></StrictMode>);
