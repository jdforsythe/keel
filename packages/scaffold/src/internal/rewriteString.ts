import type { RenameSpec } from "./RenameSpec.ts";
import { alternation } from "./alternation.ts";

/**
 * Rename references inside one string's text. Dotted tokens anywhere (word-bounded). When `inScope`: a
 * name used as an element-id or dotted prefix (`OrderCard-root`, `cart.addItem`), and a string that is
 * exactly a name when `exact`. Prose (a bare lowercase word) is left alone.
 */
export function rewriteString(text: string, spec: RenameSpec, inScope: boolean, exact: boolean): string {
  if (inScope && exact) {
    const whole = spec.names.get(text);
    if (whole !== undefined) return whole;
  }
  let t = text;
  if (spec.tokens.size > 0) {
    const re = new RegExp(`(?<![\\w$.])(?:${alternation(spec.tokens.keys())})(?![\\w$])`, "g");
    t = t.replace(re, (m) => spec.tokens.get(m) ?? m);
  }
  if (inScope && spec.names.size > 0) {
    const re = new RegExp(`(?<![\\w$])(?:${alternation(spec.names.keys())})(?=[-.][\\w$])`, "g");
    t = t.replace(re, (m) => spec.names.get(m) ?? m);
  }
  return t;
}
