import type { Io } from "../types/Io.ts";
import type { Mode } from "../types/Mode.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { RunResult } from "../types/RunResult.ts";
import type { Diag } from "./Diag.ts";
import { respond } from "./respond.ts";
import { summary } from "./summary.ts";

/** Usage diagnostics (E1051/E1052) as records: diag lines then a failing summary; exit 2. */
export function usageResult(
  command: string,
  diags: readonly Diag[],
  io: Io,
  format: Mode | undefined,
): RunResult & { readonly records: readonly OutRecord[] } {
  return respond([...diags, summary(command, diags, { errors: diags.length })], io, { command, format });
}
