import { respond as render } from "../internal/respond.ts";
import type { Mode } from "../types/Mode.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { RunResult } from "../types/RunResult.ts";

/**
 * `@keel/cli/testing` (k.cli Formatter registry): render `records` exactly as a command's records are rendered, as if
 * stdout were not a TTY (default `compact`). A record of a kind with no formatter, or one that does not fit its
 * formatter's schema, becomes E1054. For tests of `formatter` registrations (stdlib record kinds).
 */
export function respond(
  records: readonly OutRecord[],
  opts: { readonly format?: Mode | undefined } = {},
): RunResult & { readonly records: readonly OutRecord[] } {
  return render(records, { cwd: ".", tty: false }, { command: "respond", format: opts.format });
}
