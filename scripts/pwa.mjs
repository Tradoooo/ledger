#!/usr/bin/env node
/** Offline, from one implementation: a manifest, a service worker, and the registration snippet.
 *
 * Written into each built site (LED-N-09). No application file is touched, no dependency added:
 * the three sites share this one generator.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = (title) => JSON.stringify({
  name: title, short_name: title, start_url: "./", scope: "./", display: "standalone",
  background_color: "#f7f5ef", theme_color: "#8a4b16",
  icons: [{ src: "./icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" }],
}, null, 2);

/** An SVG icon, generated: no binary asset, no font, no third-party mark. */
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" rx="96" fill="#8a4b16"/>
<path d="M128 148h256M128 220h256M128 292h180M128 364h180" stroke="#f7f5ef" stroke-width="26" stroke-linecap="round"/>
</svg>`;

/** Cache-first for the shell, network-only for nothing: the app never calls out (LED-N-05). */
const SW = `const CACHE = "ledger-v1";
const SHELL = ["./", "./index.html"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match("./index.html"))),
  );
});`;

const SNIPPET = `<link rel="manifest" href="./manifest.webmanifest">
<meta name="theme-color" content="#8a4b16">
<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{})}<\/script>`;

/** Adds the offline trio to one built site. Idempotent. */
export function applyPwa(distDir, title) {
  writeFileSync(join(distDir, "manifest.webmanifest"), MANIFEST(title));
  writeFileSync(join(distDir, "sw.js"), SW);
  writeFileSync(join(distDir, "icon.svg"), ICON);
  const html = readFileSync(join(distDir, "index.html"), "utf8");
  if (!html.includes("manifest.webmanifest")) {
    writeFileSync(join(distDir, "index.html"), html.replace("</head>", `${SNIPPET}\n  </head>`));
  }
}
