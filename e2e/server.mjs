/** A static server over `dist/`: the e2e suite drives the BUILD, never the sources.
 *
 * Same contract as `scripts/smoke.mjs`: a missing file is a 404, a directory serves its
 * `index.html`, and the content type is the one a browser needs to run the bundle.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** The server answers on an ephemeral port; `base` is what the tests navigate to. */
export async function startServer(root = "dist") {
  const dir = resolve(root);
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent((request.url ?? "/").split("?")[0]));
    const file = path.endsWith("/") ? join(dir, path, "index.html") : join(dir, path);
    try {
      statSync(file);
      response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      response.end(readFileSync(file));
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
    }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((done) => server.close(done)),
  };
}
