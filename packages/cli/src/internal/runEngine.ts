import { operations } from "../operations.ts";
import type { Io } from "../types/Io.ts";
import type { EngineResult } from "./EngineResult.ts";
import { parseArgv } from "./parseArgv.ts";
import { perform } from "./perform.ts";
import { usageResult } from "./usageResult.ts";

/** Parse argv, then `perform`. Returns the writes too (tests inspect them; `io.apply` already received them). */
export async function runEngine(argv: readonly string[], io: Io): Promise<EngineResult> {
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok) {
    const r = usageResult(parsed.command, parsed.diags, io, parsed.format);
    return { result: { code: r.code, stdout: r.stdout, stderr: r.stderr }, records: r.records, writes: [] };
  }
  return perform(parsed.op, parsed.input, io);
}
