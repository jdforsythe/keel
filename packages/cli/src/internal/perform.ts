import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { Operation } from "../types/Operation.ts";
import type { EngineResult } from "./EngineResult.ts";
import { codeFilter } from "./codeFilter.ts";
import { execute } from "./execute.ts";
import { respond } from "./respond.ts";
import { withFiles } from "./withFiles.ts";

/**
 * Run one validated operation for any surface: load the operation's file scope, execute, render, and hand the
 * file effects of a successful run (exit 0) to `io.apply`. The binary and MCP both end here.
 */
export async function perform(op: Operation, input: Input, io: Io): Promise<EngineResult> {
  const outcome = await execute(op, input, withFiles(io, op.scope));
  const r = respond(outcome.records, io, { ...input, command: op.name, code: codeFilter(op, input) });
  const writes = r.code === 0 ? outcome.writes : [];
  if (writes.length > 0) io.apply?.(writes);
  return { result: { code: r.code, stdout: r.stdout, stderr: r.stderr }, records: r.records, writes };
}
