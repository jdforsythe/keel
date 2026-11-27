import type { CssRule } from "../types/CssRule.ts";
import { cssRules } from "./cssRules.ts";
import { sameCssValue } from "./sameCssValue.ts";

/** A hex color or a color function, in any form a minifier may write one. */
const COLOR = /#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/;
/** The custom properties of color and overlay tokens, whatever their value. */
const COLOR_PROP = /^--k-(?:color|overlay)-/;
const P3 = "(color-gamut:p3)";
const ROOM = 89;

/** A selector with spaces collapsed, none beside combinators or commas, and an identifier attribute value unquoted. */
const selectorKey = (s: string): string =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,])\s*/g, "$1")
    .replace(/=\s*(["'])(-?[A-Za-z_][\w-]*)\1\s*\]/g, "=$2]");
/** A condition lowercased, spaces collapsed, none beside a parenthesis or a colon. */
const condKey = (c: string): string =>
  c
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*([()])\s*/g, "$1")
    .replace(/\s*:\s*/g, ":");
const keyOf = (r: CssRule, supports = true): string =>
  JSON.stringify([
    r.layers.map((l) => l.trim()),
    r.media.map(condKey),
    supports ? r.supports.map(condKey) : [],
    selectorKey(r.selector),
  ]);

/** `say(found, expected)` within `ROOM` units: when it is longer, each value keeps an equal share and ends `...`. */
function fit(say: (found: string, expected: string) => string, found: string, expected: string): string {
  const whole = say(found, expected);
  if (whole.length <= ROOM) return whole;
  const values = (found === "" ? 0 : 1) + (expected === "" ? 0 : 1);
  const room = Math.max(4, Math.floor((ROOM - say("", "").length) / Math.max(1, values)));
  const cut = (v: string): string => (v.length <= room ? v : `${v.slice(0, room - 3)}...`);
  return say(cut(found), cut(expected)).slice(0, ROOM);
}

/**
 * The first way the built CSS `files` (each a stylesheet's text, in emit order) differ from what `compiled` (the CSS
 * `compileStyles` wrote, which check judged) says of colors, as an E1819 message, else undefined (k.gamut CSS).
 * Verified: each declaration of a `--k-color-*` or `--k-overlay-*` custom property, and of any other `--k-*` one whose
 * value holds a color here or in `compiled` (a `border` or `shadow` token's). Each must sit in a style rule of the
 * same selector, `@layer` names and `@media` conditions as a rule of `compiled` declaring it, under no `@supports`,
 * and hold a value `sameCssValue` finds equal to one `compiled` declares there; each rule `compiled` writes under
 * `(color-gamut: p3)` must follow at once the rule `compiled` writes before it; and once the files declare any `--k-*`
 * property, each declaration `compiled` makes must be in them. Any other CSS is not read.
 */
export function builtCssProblem(compiled: string, files: readonly string[]): string | undefined {
  const own = cssRules(compiled);
  const expected = new Map<string, Map<string, string[]>>();
  const colorProps = new Set<string>();
  const p3After = new Map<string, string>();
  const verified = (prop: string, value: string): boolean =>
    prop.startsWith("--k-") && (COLOR_PROP.test(prop) || colorProps.has(prop) || COLOR.test(value));
  for (const r of own)
    for (const d of r.decls) if (d.prop.startsWith("--k-") && (COLOR_PROP.test(d.prop) || COLOR.test(d.value))) colorProps.add(d.prop);
  own.forEach((r, k) => {
    const key = keyOf(r);
    for (const d of r.decls) {
      if (!colorProps.has(d.prop)) continue;
      const at = expected.get(key) ?? new Map<string, string[]>();
      at.set(d.prop, [...(at.get(d.prop) ?? []), d.value]);
      expected.set(key, at);
    }
    const before = own[k - 1];
    if (before !== undefined && r.media.some((m) => condKey(m).includes(P3)) && r.decls.some((d) => colorProps.has(d.prop)))
      p3After.set(key, keyOf(before));
  });
  const seen = new Set<string>();
  let declares = false;
  for (const text of files) {
    const rules = cssRules(text);
    for (const [k, r] of rules.entries()) {
      const key = keyOf(r);
      for (const d of r.decls) {
        if (d.prop.startsWith("--k-")) declares = true;
        if (!verified(d.prop, d.value)) continue;
        if (r.supports.length > 0) return fit((f) => `${d.prop} is ${f} under @supports in the built CSS, expected none`, d.value, "");
        const want = expected.get(key)?.get(d.prop);
        if (want === undefined) return fit((f) => `${d.prop} is ${f} in the built CSS where Keel declares none`, d.value, "");
        if (!want.some((w) => sameCssValue(w, d.value)))
          return fit((f, e) => `${d.prop} is ${f} in the built CSS, expected ${e}`, d.value, want[0] ?? "");
        seen.add(JSON.stringify([key, d.prop]));
      }
      const after = p3After.get(key);
      const prior = rules[k - 1];
      const first = r.decls.find((d) => colorProps.has(d.prop));
      if (after !== undefined && first !== undefined && (prior === undefined || keyOf(prior) !== after))
        return `${first.prop}'s P3 block does not follow its sRGB block in the built CSS`.slice(0, ROOM);
    }
  }
  if (!declares) return undefined;
  for (const [key, props] of expected)
    for (const [prop, values] of props)
      if (!seen.has(JSON.stringify([key, prop])))
        return fit((_, e) => `${prop} is missing from the built CSS, expected ${e}`, "", values[0] ?? "");
  return undefined;
}
