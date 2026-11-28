// Helpers for the k.gamut conformance files (not a test file): the compiled CSS read as a tree of rules, so a
// declaration's enclosing conditions and its neighbours can be asserted without string slicing. Public API only.
import { norm } from "./fixtures.ts";

export type Rule = { prelude: string; decls: string[]; rules: Rule[] };
export type Found = { value: string; chain: string[]; siblings: Rule[]; index: number };

/** A stylesheet (whitespace-normal form, fixtures.ts `norm`) as rules; a declaration is `prop:value`. */
export const parseCss = (css: string): Rule => {
  const src = norm(css);
  let i = 0;
  const body = (prelude: string): Rule => {
    const node: Rule = { prelude, decls: [], rules: [] };
    let buf = "";
    let depth = 0;
    while (i < src.length) {
      const ch = src.charAt(i++);
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth === 0 && ch === "{") {
        node.rules.push(body(buf.trim()));
        buf = "";
      } else if (depth === 0 && ch === "}") {
        if (buf.trim() !== "") node.decls.push(buf.trim());
        return node;
      } else if (depth === 0 && ch === ";") {
        if (buf.trim() !== "") node.decls.push(buf.trim());
        buf = "";
      } else buf += ch;
    }
    if (buf.trim() !== "") node.decls.push(buf.trim());
    return node;
  };
  return body("");
};

/** Every declaration of `prop`, with the preludes of the rules around it (outermost first) and the rule's siblings. */
export const declsOf = (css: string, prop: string): Found[] => {
  const out: Found[] = [];
  const walk = (node: Rule, chain: string[], siblings: Rule[], index: number): void => {
    for (const d of node.decls)
      if (d.startsWith(`${prop}:`)) out.push({ value: d.slice(prop.length + 1), chain, siblings, index });
    node.rules.forEach((r, k) => walk(r, [...chain, r.prelude], node.rules, k));
  };
  const root = parseCss(css);
  walk(root, [], [root], 0);
  return out;
};

/** The rule that holds a found declaration (its chain's last prelude among its siblings). */
export const ruleOf = (f: Found): Rule | undefined => f.siblings[f.index];

/** `@media screen and (color-gamut: p3)` in the whitespace-normal form of fixtures.ts `norm`, which drops the space before a bracket. */
export const P3_MEDIA = "@media screen and(color-gamut:p3)";
