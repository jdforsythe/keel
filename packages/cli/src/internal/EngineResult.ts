import type { OutRecord } from "../types/OutRecord.ts";
import type { RunResult } from "../types/RunResult.ts";
import type { Write } from "../types/Write.ts";

/** One engine call: the rendered result, the records behind it, and the file effects for the host. */
export type EngineResult = {
  readonly result: RunResult;
  readonly records: readonly OutRecord[];
  readonly writes: readonly Write[];
};
