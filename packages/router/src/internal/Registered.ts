import type { RouteDef } from "../types/RouteDef.ts";
import type { Segment } from "./Segment.ts";

/** A route as registered by `manifest()`: its id, definition, and compiled path (`null` for a layout). */
export type Registered = { readonly id: string; readonly def: RouteDef; readonly segments: readonly Segment[] | null };
