import type { Node } from "./Node.ts";

/** What `s.format` keeps beside its node in memory: the predicate (over `base`) and the generator recipe. */
export interface FormatImpl {
  /** True when `base` accepts `x` and `check` returns true; a throwing `check` is false. */
  readonly test: (x: unknown) => boolean;
  /** The node of the schema whose generator feeds `map`. */
  readonly from: Node;
  readonly map: (x: unknown) => unknown;
}
