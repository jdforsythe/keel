import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/**
 * The inspector hooks registry (k.inspect): one entry per section id, in registration order. Written only by
 * `inspector` and `inspectorsReload`, read only by `inspectorSections`; the record type of each entry is erased
 * behind its schema. `carried` marks an entry registered before the server's modules were last loaded again.
 */
export const inspectors: Map<
  string,
  { readonly schema: Schema<unknown>; readonly read: (ctx: Ctx) => unknown; readonly carried: boolean }
> = new Map();
