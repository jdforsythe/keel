import { combine } from "../internal/combine.ts";
import { TokenSchema } from "../tokens/TokenSchema.ts";
import type { Combination } from "../types/Combination.ts";
import type { Tokens } from "../types/Tokens.ts";

/**
 * The app's combinations (k.themes Combinations), at most 54, each `{ name, tokens }` with that combination's values
 * flat (no `themes`, no pair), and its scheme, whether it prints and which themes are on. Throws an Error with
 * `code: 'E1807'` for tokens `TokenSchema` refuses, as `defineTokens` does.
 */
export function combinations(tokens: Tokens): Combination[] {
  const r = TokenSchema.parse(tokens);
  if (!r.ok) throw Object.assign(new Error(`tokens fail TokenSchema: ${r.error.message}`), { code: "E1807" });
  return combine(tokens);
}
