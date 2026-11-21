import type { Edit } from "../types/Edit.ts";

/**
 * What a type error inside a `contract` or `manifest` argument maps to (k.routes Where rules fire): a Keel code with
 * its message and, when a fix exists, the edits that make it; `"reported"` when a static pass reports the fault at
 * that node already (a contract key without the module prefix, E1155 from the k.module pass).
 */
export type Mapped = readonly [code: string, message: string, edits?: readonly Edit[]] | "reported";
