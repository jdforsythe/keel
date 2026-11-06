#!/usr/bin/env node
// The `keel` binary: the only surface that touches the process. Reads the project into `io.files`, calls the
// engine, writes stdout, sets the exit code. `mcp` and `lsp` stream over stdio; `test` delegates to vitest.
import { delegateTest } from "./internal/delegateTest.ts";
import { hostIo } from "./internal/hostIo.ts";
import { parseArgv } from "./internal/parseArgv.ts";
import { serve } from "./internal/serve.ts";
import { lsp } from "./lsp.ts";
import { mcp } from "./mcp.ts";
import { operations } from "./operations.ts";
import { run } from "./run.ts";

const argv = process.argv.slice(2);
const head = argv[0];
const parsed = parseArgv(argv, operations);

if ((head === "mcp" || head === "lsp") && argv.length === 1) {
  serve(head === "mcp" ? mcp(() => hostIo(true)) : lsp(() => hostIo(true)));
} else if (head === "test" && parsed.ok) {
  process.exitCode = delegateTest(parsed.input.paths ?? []);
} else {
  const r = await run(argv, hostIo(head !== "test" && head !== "explain"));
  if (r.stdout !== "") process.stdout.write(r.stdout);
  if (r.stderr !== "") process.stderr.write(r.stderr);
  process.exitCode = r.code;
}
