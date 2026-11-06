import type { Attach } from "./Attach.ts";

/** Registered (non-kernel) capabilities in registration order. Module-level: the registry is process-wide. */
export const extensions: Map<string, Attach> = new Map();
