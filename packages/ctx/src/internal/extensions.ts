import type { Registration } from "./Registration.ts";

/** Registered (non-kernel) capabilities in registration order. Module-level: the registry is process-wide. */
export const extensions: Map<string, Registration> = new Map();
