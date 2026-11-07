#!/usr/bin/env node
// The `keel` binary: the only surface that touches the process. Everything goes through `run` with a host `Io`:
// the engine loads the files each operation needs and applies its effects; `mcp` and `lsp` stream over stdio.
// `build` and `dev` hand bundling and serving to Vite when `vite.config.ts` exists; `build` runs Vite once per
// `viteTargets` (k.server Build: each `node` deployable's client build to `dist/<name>/`).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hostIo } from "./internal/hostIo.ts";
import { viteRun } from "./internal/viteRun.ts";
import { viteTargets } from "./internal/viteTargets.ts";
import { run } from "./run.ts";

const argv = process.argv.slice(2);
const head = argv[0];
const cwd = process.cwd();
const serving = (head === "mcp" || head === "lsp") && argv.length === 1;

const vite = head === "dev" && argv.length === 1 ? viteRun(cwd, "dev") : undefined;
if (vite !== undefined) process.exitCode = vite.code;
else {
  const r = await run(argv, hostIo(serving));
  if (r.stdout !== "") process.stdout.write(r.stdout);
  if (r.stderr !== "") process.stderr.write(r.stderr);
  process.exitCode = r.code;
  if (head === "build" && r.code === 0) {
    const topo = join(cwd, "topology.ts");
    for (const target of viteTargets(existsSync(topo) ? readFileSync(topo, "utf8") : undefined)) {
      const b = viteRun(cwd, "build", target);
      for (const note of b?.notes ?? []) process.stderr.write(note);
      if (b !== undefined && b.code !== 0) {
        process.stderr.write(b.tail);
        process.exitCode = 1;
        break;
      }
    }
  }
  if (serving) process.exit();
}
