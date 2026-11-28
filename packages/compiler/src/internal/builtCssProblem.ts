import type { CssRule } from "../types/CssRule.ts";
import { cssRules } from "./cssRules.ts";
import { sameCssValue } from "./sameCssValue.ts";

/** A hex color or a color function, in any form a minifier may write one. */
const COLOR = /#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/;
/** The custom properties of color and overlay tokens, whatever their value. */
const COLOR_PROP = /^--k-(?:color|overlay)-/;
/** A `--k-*` declaration written anywhere in a text: its property and its value up to `;`, `}`, a quote or a line end. */
const DECL_IN_TEXT = /(--k-[A-Za-z0-9_-]+)\s*:\s*([^;{}"'`\\\n]*)/g;
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
const keyOf = (r: CssRule, wrappers = true): string =>
  JSON.stringify([
    r.layers.map((l) => l.trim()),
    r.media.map(condKey),
    wrappers ? r.wrappers.map(condKey) : [],
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
 * The first way a deployable's built output differs from what `compiled` (the CSS `compileStyles` wrote, which check
 * judged) says of Keel's custom properties, as an E1819 message, else undefined (k.gamut CSS). `files` are the
 * output's text files as written, each by its path under the output folder, in path order.
 *
 * In a `.css` file, each `--k-*` declaration must sit in a style rule whose selector, `@layer` names, `@media`
 * conditions and every other at-rule around it (`cssRules`) are those of a rule of `compiled` declaring that
 * property; a color one (a `--k-color-*` or `--k-overlay-*` property, or another `--k-*` one whose value holds a color
 * here or in `compiled`) must also hold a value `sameCssValue` finds equal to one `compiled` declares there, and each
 * P3 block must follow at once the rule `compiled` writes before it. Each color declaration of `compiled` must be
 * found so: when `compiled` declares none (an app with no color tokens) there is nothing to find. In any other file
 * (JavaScript, HTML, SVG) a color declaration is refused wherever it is: Keel's CSS ships in `.css` files.
 */
export function builtCssProblem(
  compiled: string,
  files: readonly { readonly path: string; readonly text: string }[],
): string | undefined {
  const own = cssRules(compiled);
  const expected = new Map<string, Map<string, string[]>>();
  const colorProps = new Set<string>();
  const p3After = new Map<string, string>();
  const isColor = (prop: string, value: string): boolean =>
    prop.startsWith("--k-") && (COLOR_PROP.test(prop) || colorProps.has(prop) || COLOR.test(value));
  for (const r of own)
    for (const d of r.decls)
      if (d.prop.startsWith("--k-") && (COLOR_PROP.test(d.prop) || COLOR.test(d.value))) colorProps.add(d.prop);
  own.forEach((r, k) => {
    const key = keyOf(r);
    for (const d of r.decls) {
      if (!d.prop.startsWith("--k-")) continue;
      const at = expected.get(key) ?? new Map<string, string[]>();
      at.set(d.prop, [...(at.get(d.prop) ?? []), d.value]);
      expected.set(key, at);
    }
    const before = own[k - 1];
    if (
      before !== undefined &&
      r.media.some((m) => condKey(m).includes(P3)) &&
      r.decls.some((d) => colorProps.has(d.prop))
    )
      p3After.set(key, keyOf(before));
  });
  const seen = new Set<string>();
  for (const file of files) {
    if (!file.path.endsWith(".css")) {
      for (const m of file.text.matchAll(DECL_IN_TEXT)) {
        const prop = m[1] ?? "";
        const value = (m[2] ?? "").trim();
        if (isColor(prop, value))
          return fit((f) => `${prop} is ${f} in ${file.path}; Keel's CSS ships in .css files`, value, "");
      }
      continue;
    }
    const rules = cssRules(file.text);
    for (const [k, r] of rules.entries()) {
      const key = keyOf(r);
      for (const d of r.decls) {
        if (!d.prop.startsWith("--k-")) continue;
        const want = expected.get(key)?.get(d.prop);
        if (want === undefined) {
          const bare = expected.get(keyOf(r, false))?.has(d.prop) === true;
          const extra = r.wrappers.find((w) => !own.some((o) => o.wrappers.some((x) => condKey(x) === condKey(w))));
          const name = /^@[\w-]+/.exec(extra ?? r.wrappers[0] ?? "")?.[0];
          if (name !== undefined && (bare || extra !== undefined))
            return fit((f) => `${d.prop} is ${f} under ${name} in the built CSS, expected none`, d.value, "");
          return fit((f) => `${d.prop} is ${f} in the built CSS where Keel declares none`, d.value, "");
        }
        if (isColor(d.prop, d.value) && !want.some((w) => sameCssValue(w, d.value)))
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
  for (const [key, props] of expected)
    for (const [prop, values] of props)
      if (colorProps.has(prop) && !seen.has(JSON.stringify([key, prop])))
        return fit((_, e) => `${prop} is missing from the built CSS, expected ${e}`, "", values[0] ?? "");
  return undefined;
}
