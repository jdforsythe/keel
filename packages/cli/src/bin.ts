#!/usr/bin/env node
// The `keel` binary: the only surface that touches the process. Reads the project into `io.files`, calls the
// engine, writes stdout, applies file effects (scaffold, codemod, build), sets the exit code. `mcp` and `lsp`
// stream over stdio; `build` and `dev` hand bundling and serving to Vite when `vite.config.ts` exists.
import { applyWrites } from "./internal/applyWrites.ts";
import { hostIo } from "./internal/hostIo.ts";
import { runEngine } from "./internal/runEngine.ts";
import { serve } from "./internal/serve.ts";
import { viteRun } from "./internal/viteRun.ts";
import { lsp } from "./lsp.ts";
import { mcp } from "./mcp.ts";
import { run } from "./run.ts";

const argv = process.argv.slice(2);
const head = argv[0];
const cwd = process.cwd();
const TREE: readonly (string | undefined)[] = ["scaffold", "codemod", "build"];
const NONE: readonly (string | undefined)[] = ["explain", "inspect", "render"];
const out = (text: string): void => {
  if (text !== "") process.stdout.write(text);
};

if ((head === "mcp" || head === "lsp") && argv.length === 1) {
  serve(
    head === "mcp"
      ? mcp(
          () => hostIo("tree"),
          (writes) => applyWrites(cwd, writes),
        )
      : lsp(() => hostIo("query")),
  );
} else if (head === "mcp" || head === "lsp") {
  const r = await run(argv, hostIo("none"));
  out(r.stdout);
  process.exitCode = r.code;
} else {
  const vite = head === "dev" && argv.length === 1 ? viteRun(cwd, "dev") : undefined;
  if (vite !== undefined) process.exitCode = vite.code;
  else {
    const e = await runEngine(argv, hostIo(TREE.includes(head) ? "tree" : NONE.includes(head) ? "none" : "query"));
    applyWrites(cwd, e.writes);
    out(e.result.stdout);
    if (e.result.stderr !== "") process.stderr.write(e.result.stderr);
    process.exitCode = e.result.code;
    if (head === "build" && e.result.code === 0) {
      const b = viteRun(cwd, "build");
      if (b !== undefined && b.code !== 0) {
        process.stderr.write(b.tail);
        process.exitCode = 1;
      }
    }
  }
}
