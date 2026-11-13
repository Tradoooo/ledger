#!/usr/bin/env node
/** Builds the three published sites. Three URLs, not fourteen: see .kiro/steering/lean.md */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const SITES = [
  { name: "skeleton", dir: "skeleton" },
  { name: "envelopes", dir: "apps/envelopes" },
  { name: "mutual-aid", dir: "apps/mutual-aid" },
];
let failed = false;
for (const site of SITES) {
  if (!existsSync(`${site.dir}/index.html`) || !existsSync(`${site.dir}/src/main.tsx`)) {
    console.log(`skip ${site.name}: no entry yet (index.html + src/main.tsx required)`);
    continue;
  }
  const result = spawnSync("npx", ["vite", "build", "--outDir", `../../dist/${site.name}`, "--emptyOutDir"], {
    cwd: site.dir, stdio: "inherit", timeout: 240_000,
  });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
