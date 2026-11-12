#!/usr/bin/env node
// The `keel` binary: the only surface that touches the process. Everything goes through `run` with a host `Io`:
// the engine loads the files each operation needs and applies its effects; `mcp` and `lsp` stream over stdio.
// `build` and `dev` hand bundling and serving to Vite when `vite.config.ts` exists: `dev` runs the project's Vite in
// this process (`devStart`); `build` runs Vite once per `viteTargets` (k.server Build, k.hosting: each `client` and
// `node` deployable's build to `dist/<name>/`); when every deployable is `node`, `routesRun` writes `routes.json`
// first, since no other build does; `surfaceRun` then writes `surface.json` (k.compat).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { devStart } from "./internal/devStart.ts";
import { hostIo } from "./internal/hostIo.ts";
import { routesRun } from "./internal/routesRun.ts";
import { surfaceRun } from "./internal/surfaceRun.ts";
import { viteRun } from "./internal/viteRun.ts";
import { viteTargets } from "./internal/viteTargets.ts";
import { run } from "./run.ts";

const argv = process.argv.slice(2);
const head = argv[0];
const cwd = process.cwd();
const serving = (head === "mcp" || head === "lsp") && argv.length === 1;

const dev = head === "dev" && existsSync(join(cwd, "vite.config.ts")) ? await devStart(argv, cwd) : undefined;
if (dev !== undefined) {
  if (!dev.serving) {
    process.exitCode = dev.code;
    // A dev server that was created and closed may leave Vite's handles behind; the output is flushed, then the
    // process ends.
    process.stderr.write(dev.stderr, () => process.stdout.write(dev.stdout, () => process.exit()));
  }
} else {
  const r = await run(argv, hostIo(serving));
  if (r.stdout !== "") process.stdout.write(r.stdout);
  if (r.stderr !== "") process.stderr.write(r.stderr);
  process.exitCode = r.code;
  if (head === "build" && r.code === 0) {
    const topo = join(cwd, "topology.ts");
    const topology = existsSync(topo) ? readFileSync(topo, "utf8") : undefined;
    const routes = await routesRun(cwd, topology);
    for (const note of routes.notes) process.stderr.write(note);
    if (routes.code !== 0) process.exitCode = routes.code;
    const surface = routes.code === 0 ? await surfaceRun(cwd) : { code: 0, notes: [] };
    for (const note of surface.notes) process.stderr.write(note);
    if (surface.code !== 0) process.exitCode = surface.code;
    for (const target of routes.code === 0 ? viteTargets(topology) : []) {
      const b = viteRun(cwd, target);
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
