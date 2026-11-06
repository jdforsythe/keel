import type { Schema } from "../Schema.ts";

/** Named schemas registered via `s.register` (stdlib extension point). */
export const registry = new Map<string, Schema<unknown, boolean>>();
