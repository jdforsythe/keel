import { operations } from "../operations.ts";
import type { Io } from "../types/Io.ts";
import type { EngineResult } from "./EngineResult.ts";
import { loadStd } from "./loadStd.ts";
import { parseArgv } from "./parseArgv.ts";
import { perform } from "./perform.ts";
import { respond } from "./respond.ts";
import { sniffFormat } from "./sniffFormat.ts";
import { stdSlot } from "./stdSlot.ts";
import { unavailable } from "./unavailable.ts";
import { usageResult } from "./usageResult.ts";

/** Parse argv, then `perform`. Returns the writes too (tests inspect them; `io.apply` already received them). */
export async function runEngine(argv: readonly string[], io: Io): Promise<EngineResult> {
  const std = argv[0];
  if (std === "session" || std === "report") {
    // A stdlib module fills the slot when the project's std deps load; unfilled: I1055 (info), exit 0 (k.cli Rules).
    const loaded = await loadStd(io);
    const op = stdSlot.get(std);
    if (op !== undefined) {
      const parsedStd = parseArgv(argv, [op]);
      if (!parsedStd.ok) {
        const u = usageResult(parsedStd.command, parsedStd.diags, io, parsedStd.format);
        return {
          result: { code: u.code, stdout: u.stdout, stderr: u.stderr },
          records: u.records,
          writes: [],
        };
      }
      return perform(parsedStd.op, parsedStd.input, io);
    }
    const unfilled = unavailable(std, `the stdlib ${std} module`, "k.cli");
    const r = respond(loaded.length === 0 ? unfilled : [...loaded, ...unfilled], io, {
      command: std,
      format: sniffFormat(argv),
    });
    return {
      result: { code: r.code, stdout: r.stdout, stderr: r.stderr },
      records: r.records,
      writes: [],
    };
  }
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok) {
    const r = usageResult(parsed.command, parsed.diags, io, parsed.format);
    return {
      result: { code: r.code, stdout: r.stdout, stderr: r.stderr },
      records: r.records,
      writes: [],
    };
  }
  return perform(parsed.op, parsed.input, io);
}
