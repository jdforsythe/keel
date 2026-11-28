import type { Program } from "oxc-parser";
import type { Val } from "./Val.ts";
import { afterSpreads } from "./afterSpreads.ts";
import { literalValue } from "./literalValue.ts";
import { tokensShape } from "./tokensShape.ts";

/** The value `chain` (group, then name; `themes`, a theme, a group and a name for a theme) holds in the `defineTokens({...})` literal of `program`, as written there; undefined when it is not written as a string or pair. */
export function staticValue(program: Program, chain: readonly string[]): Val | undefined {
  let at = tokensShape(program)?.literal;
  for (const [i, key] of chain.entries()) {
    const p = at === undefined ? undefined : afterSpreads(at, key);
    if (p === undefined) return undefined;
    if (i === chain.length - 1) return literalValue(p.value);
    at = p.value.type === "ObjectExpression" ? p.value : undefined;
  }
  return undefined;
}
