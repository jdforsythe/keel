import type { Located } from "./Located.ts";
import type { Rec } from "./Rec.ts";

/**
 * Result of matching a URL. `url` is canonical (no trailing slash). `notFound` carries the structurally
 * matched route when its params failed their schema, or `null` when no pattern matched.
 */
export type Match =
  | {
      readonly kind: "route";
      readonly url: string;
      readonly route: Located;
      readonly params: Rec;
      readonly search: Rec;
    }
  | { readonly kind: "notFound"; readonly url: string; readonly route: Located | null };
