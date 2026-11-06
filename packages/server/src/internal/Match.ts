import type { Located } from "./Located.ts";
import type { Rec } from "./Rec.ts";

/**
 * Result of matching a request path. `notFound` carries the structurally matched route when its params
 * failed their schema, or `null` when no pattern matched.
 */
export type Match =
  | { readonly kind: "route"; readonly route: Located; readonly params: Rec; readonly search: Rec }
  | { readonly kind: "notFound"; readonly route: Located | null };
