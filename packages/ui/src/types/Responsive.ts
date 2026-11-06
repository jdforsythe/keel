import type { Computed } from "@keel/reactive";

/**
 * A style value: `T`, a reactive value `D` (a signal or computed, switched by class), or values keyed by
 * breakpoint name (`base` unconditioned, each breakpoint inside its `min-width` media query).
 */
export type Responsive<T extends string, D = Computed<string>> =
  | T
  | D
  | { readonly [breakpoint: string]: T | D | undefined };
