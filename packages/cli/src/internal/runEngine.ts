import { operations } from "../operations.ts";
import type { Io } from "../types/Io.ts";
import type { EngineResult } from "./EngineResult.ts";
import { codeFilter } from "./codeFilter.ts";
import { execute } from "./execute.ts";
import { parseArgv } from "./parseArgv.ts";
import { respond } from "./respond.ts";
import { usageResult } from "./usageResult.ts";

/** Parse argv, execute, render. Writes are returned, never applied: `run` drops them, the binary applies them. */
export async function runEngine(argv: readonly string[], io: Io): Promise<EngineResult> {
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok) {
    const r = usageResult(parsed.command, parsed.diags, io, parsed.format);
    return { result: { code: r.code, stdout: r.stdout, stderr: r.stderr }, records: r.records, writes: [] };
  }
  const { op, input } = parsed;
  const outcome = await execute(op, input, io);
  const r = respond(outcome.records, io, { ...input, command: op.name, code: codeFilter(op, input) });
  const writes = r.code === 0 ? outcome.writes : [];
  return { result: { code: r.code, stdout: r.stdout, stderr: r.stderr }, records: r.records, writes };
}
