import { s } from "@keel/schema";
import { isDigested } from "./internal/isDigested.ts";
import { simText } from "./internal/simText.ts";

/**
 * A stored token digest, registered as `credentials.Digested`: `$id$digest` or `$id$params$digest`, at most 128
 * characters. It checks the shape only. Its generator gives sim-form strings, `$sha256-sim$<digest>`.
 */
export const Digested = s.format("credentials.Digested", s.string(), {
  check: isDigested,
  gen: { from: s.string(), map: (v: string) => `$sha256-sim$${simText(v, 43)}` },
});
export type Digested = s.infer<typeof Digested>;

s.register("credentials.Digested", Digested);
