import type { Ref } from "./Ref.ts";

/**
 * A rebased `entry` of `store` whose result depends on its order against its concurrent entries `against` (std.conflicts):
 * `order` when both orders hold with different states, `invalid` when exactly one order fails an invariant or a schema.
 */
export interface Race {
  readonly store: string;
  readonly entry: Ref;
  readonly against: readonly Ref[];
  readonly kind: "order" | "invalid";
}
