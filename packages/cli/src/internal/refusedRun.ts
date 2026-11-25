import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { RunResult } from "../types/RunResult.ts";
import { makeDiag } from "./makeDiag.ts";
import { respond } from "./respond.ts";
import { sniffFormat } from "./sniffFormat.ts";
import { summary } from "./summary.ts";

/** The result of a command whose writes `applyWrites` refused (`WriteRefused`): one E1357 for the set, at its first refused path, exit 1, with the records (the binary prints them, MCP wraps them). */
export function refusedRun(
  paths: readonly string[],
  argv: readonly string[],
  io: Io,
): RunResult & { readonly records: readonly OutRecord[] } {
  const diags = paths
    .slice(0, 1)
    .map((path) =>
      makeDiag("E1357", "a symlink leads this write out of the project; nothing written", { path, see: "k.scaffold" }),
    );
  const r = respond([...diags, summary(argv[0] ?? "keel", diags, {})], io, {
    command: argv[0] ?? "keel",
    format: sniffFormat(argv),
  });
  return r;
}
