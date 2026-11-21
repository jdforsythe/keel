import type { Def } from "./Def.ts";
import type { Segment } from "./Segment.ts";

/** A route of a compiled table: its id, its `Def`, and its compiled path (`null` for a layout). */
export type Registered = { readonly id: string; readonly def: Def; readonly segments: readonly Segment[] | null };
