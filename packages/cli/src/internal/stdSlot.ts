import type { StdOperation } from "../types/StdOperation.ts";

/** The reserved command slots (k.cli), by name: empty until `stdCommand` fills one. Process-wide, like the formatter registry. */
export const stdSlot = new Map<string, StdOperation>();
