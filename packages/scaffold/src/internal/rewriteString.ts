import type { RenameSpec } from "./RenameSpec.ts";
import { alternation } from "./alternation.ts";
import { idNames } from "./idNames.ts";
import { rewriteId } from "./rewriteId.ts";

/**
 * Rename references inside one string's text, only where the text has a known id shape. Anywhere: a dotted
 * store/route id (`orders.cart`, `orders.cart.addItem`) as a whole token. When `inScope`: a string that is
 * exactly a name when `exact`; an element id whose first `.`/`-` segment is a whole name, either the whole
 * string in an id position (`isId`: JSX `id`, `id:` property, `find`/`fire`/`a11y` argument) or an
 * `id="..."` attribute inside the text. Bare prefixes elsewhere (`cart-icon`, `cart.json`) never change.
 */
export function rewriteString(text: string, spec: RenameSpec, inScope: boolean, exact: boolean, isId: boolean): string {
  if (inScope && exact) {
    const whole = spec.names.get(text);
    if (whole !== undefined) return whole;
  }
  let t = text;
  if (spec.tokens.size > 0) {
    const re = new RegExp(`(?<![\\w$.])(?:${alternation(spec.tokens.keys())})(?![\\w$])`, "g");
    t = t.replace(re, (m) => spec.tokens.get(m) ?? m);
  }
  if (!inScope) return t;
  const ids = idNames(spec);
  if (isId) return rewriteId(t, ids);
  return t.replace(
    /(?<![\w$-])id=(["'])([^"']*)\1/g,
    (_m, q: string, id: string) => `id=${q}${rewriteId(id, ids)}${q}`,
  );
}
