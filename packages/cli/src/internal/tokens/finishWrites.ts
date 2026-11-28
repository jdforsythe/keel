import type { Io } from "../../types/Io.ts";
import type { OutRecord } from "../../types/OutRecord.ts";
import type { Write } from "../../types/Write.ts";
import type { Outcome } from "../Outcome.ts";
import { applyWrites } from "../applyWrites.ts";
import { isError } from "../isError.ts";

/**
 * The outcome of a command that edits files of the project at `io.cwd`. A host that applies effects (`io.apply`: the
 * binary and MCP) gets them as `writes`; a run on a real directory without one applies them itself, none after an error.
 */
export function finishWrites(io: Io, records: readonly OutRecord[], writes: readonly Write[]): Outcome {
  if (io.apply !== undefined || records.some(isError)) return { records, writes: records.some(isError) ? [] : writes };
  applyWrites(io.cwd, writes);
  return { records, writes: [] };
}
