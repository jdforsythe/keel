#!/usr/bin/env node
// The `keel` binary: the only surface that touches the process. Everything goes through `run` with a host `Io`:
// the engine loads the files each operation needs and applies its effects; `mcp` and `lsp` stream over stdio.
// `dev` hands serving to Vite when `vite.config.ts` exists, running the project's Vite in this process (`devStart`);
// `build` runs its disk half (`routes.json`, `surface.json`, the Vite builds) through the host `Io.build`, as MCP does.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { devStart } from "./internal/devStart.ts";
import { hostIo } from "./internal/hostIo.ts";
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
  if (serving) process.exit();
}
