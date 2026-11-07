import type { Id } from "@keel/schema";

/**
 * Randomness capability. `float()` is in [0, 1); `id(brand)` is a fresh v4 UUID typed as `s.id(brand)`, the one
 * way to mint an id or token (RFC 0043: there is no untyped `uuid()`).
 */
export interface Random {
  id<B extends string>(brand: B): Id<B>;
  float(): number;
}
