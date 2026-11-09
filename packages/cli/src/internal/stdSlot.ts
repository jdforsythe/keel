import type { StdOperation } from "../types/StdOperation.ts";

/** The `session` command slot (k.cli): empty until `stdCommand` fills it. Process-wide, like the formatter registry. */
export const stdSlot: { op: StdOperation | undefined } = { op: undefined };
