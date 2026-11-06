import type { Input } from "../types/Input.ts";
import type { Operation } from "../types/Operation.ts";

/** The `--code` display filter: only when `code` is a flag of the operation, not its positional argument. */
export function codeFilter(op: Operation, input: Input): string | undefined {
  return op.positional.includes("code") ? undefined : input.code;
}
