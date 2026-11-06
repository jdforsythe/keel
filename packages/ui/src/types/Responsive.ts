import type { Computed } from "@keel/reactive";
import type { TokenName } from "../internal/TokenName.ts";

/**
 * A style value: `T`, a reactive value `D` (a signal or computed, switched by class), or values keyed by
 * breakpoint (`base` unconditioned, each breakpoint name inside its `min-width` media query).
 */
export type Responsive<T extends string, D = Computed<string>> =
  | T
  | D
  | ({ readonly base?: T | D } & { readonly [B in TokenName<"breakpoint">]?: T | D });
