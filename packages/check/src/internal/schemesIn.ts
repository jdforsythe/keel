import { TokenSchema } from "@keel/ui/tokens";
import { type Scheme, schemesOf } from "@keel/ui/css";

const memo = new WeakMap<object, readonly Scheme[]>();
const BOTH: readonly Scheme[] = ["light", "dark"];

/**
 * The color schemes of the tokens artifact (k.schemes Schemes, `schemesOf`): anything that fails `TokenSchema` counts as
 * both, so contrast is judged in each. Memoized per artifact object.
 */
export function schemesIn(tokens: unknown): readonly Scheme[] {
  if (typeof tokens !== "object" || tokens === null) return BOTH;
  const hit = memo.get(tokens);
  if (hit !== undefined) return hit;
  const parsed = TokenSchema.parse(tokens);
  const out = parsed.ok ? schemesOf(parsed.value) : BOTH;
  memo.set(tokens, out);
  return out;
}
