import { operations } from "../operations.ts";
import type { Io } from "../types/Io.ts";
import type { EngineResult } from "./EngineResult.ts";
import { parseArgv } from "./parseArgv.ts";
import { perform } from "./perform.ts";
import { respond } from "./respond.ts";
import { sniffFormat } from "./sniffFormat.ts";
import { unavailable } from "./unavailable.ts";
import { usageResult } from "./usageResult.ts";

/** Parse argv, then `perform`. Returns the writes too (tests inspect them; `io.apply` already received them). */
export async function runEngine(argv: readonly string[], io: Io): Promise<EngineResult> {
  if (argv[0] === "session") {
    // Reserved for the stdlib sessions module: I1055 (info), exit 0 (k.cli Rules).
    const r = respond(unavailable("session", "the stdlib sessions module", "k.cli"), io, {
      command: "session",
      format: sniffFormat(argv),
    });
    return { result: { code: r.code, stdout: r.stdout, stderr: r.stderr }, records: r.records, writes: [] };
  }
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok) {
    const r = usageResult(parsed.command, parsed.diags, io, parsed.format);
    return { result: { code: r.code, stdout: r.stdout, stderr: r.stderr }, records: r.records, writes: [] };
  }
  return perform(parsed.op, parsed.input, io);
}
