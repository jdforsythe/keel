import type { Id } from "@keel/schema";

/**
 * Randomness capability. `float()` is in [0, 1); `uuid()` is a v4 UUID string;
 * `id(brand)` is a fresh v4 UUID typed as `s.id(brand)` (use `id` for schema ids, `uuid` for raw strings).
 */
export interface Random {
  uuid(): string;
  id<B extends string>(brand: B): Id<B>;
  float(): number;
}
