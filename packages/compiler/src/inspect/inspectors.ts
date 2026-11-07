import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/**
 * The inspector hooks registry (k.cli): one entry per section id, in registration order. Written only by
 * `inspector`, read only by `inspectorSections`; the record type of each entry is erased behind its schema.
 */
export const inspectors: Map<string, { readonly schema: Schema<unknown>; readonly read: (ctx: Ctx) => unknown }> =
  new Map();
