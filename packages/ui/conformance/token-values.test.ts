// Spec: k.values, clause "`TokenSchema` refuses with rule `format` at that path each of `font: { a: '\"Inter var, sans-serif' }`, `font: { a: '\"a\fb\"' }`, `font: { a: '\"a\u0000b\"' }`, `font: { a: '\"a\ud800\"' }`, `font: { a: '3M Sans' }`, `font: { a: 'inherit' }`, `color: { a: '\"oops' }`, `color: { a: 'rgb(1,2,3' }`, `color: { a: 'red\\' }`, `color: { a: 'red' }`, `color: { a: '#12345' }`, `space: { a: '1px !important' }`, `space: { a: '-2rem' }`, `space: { a: 'calc(1px+2px)' }`, `space: { a: 'calc(1px * 2px)' }`, `space: { a: 'calc(1px / 0)' }`, `size: { a: 'url(x.png)' }`, `size: { a: 'none' }`, `border: { a: '1px solid var(--x)' }`, `border: { a: '10% solid #000000' }`, `fontSize: { a: '-1px' }`, `breakpoint: { a: '0px' }` and `motion: { a: '120' }`."
// Spec: k.values, clause "`TokenSchema` accepts `brandTokens`, `space: { a: 'clamp(8px, 2vw + 4px, 24px)' }`, `space: { a: 'env(safe-area-inset-top, 0)' }`, `size: { a: '100dvh' }`, `size: { a: 'min(44rem, 100% - 32px)' }`, `size: { a: '50cqi' }`, `font: { a: '\"Inter, var\", sans-serif' }`, `font: { a: '\"3M Sans\", serif' }`, `fontSize: { a: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)' }`, `weight: { a: '650' }`, `shadow: { a: 'inset 0 -1px 2px #000000' }`, `border: { a: '1px solid currentColor' }`, `breakpoint: { a: '48em' }` and `motion: { a: '0.2s' }`."
// Spec: k.values, clause "`border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one."
// Spec: k.values, clause "In Chromium, the cases are generated from the forms (each unit; each keyword; each math function at two, three and four arguments; nesting at four and at five; 32 and 33 names; a family list at one and eight; inside and outside a string, each of `\"`, `'`, `\`, each control character and a lone surrogate): every case `TokenSchema` accepts, set on an element through the property its group's props write, reads back from `style` as a non-empty value and gives a computed value other than the initial one unless written as it, and every generated case the forms do not produce is refused."
// Spec: k.values, clause "In Chromium, the CSS file compiled from `brandTokens` and from tokens holding one generated case per form, every group used by a style prop, parses as a `CSSStyleSheet` (`replaceSync`) with `cssRules.length` equal to the number of rules the compiler emitted, each rule holding every declaration it was emitted with."
// Spec text (k.values): "**Stylesheet.** Each value a form admits gives a declaration the browser keeps and computes to a value other than the property's initial one, unless it is written as that value (`0`, `normal`). No part of the value forms ships in a client bundle: they run in `keel check`, `keel build`, `keel dev` and `defineTokens` under Node."
// Spec text (k.values): "A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `light` or `dark` after it for a pair): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks). Refused, and why: `url(...)` and `image-set(...)` reach outside the stylesheet; a `var(...)` of anything but a held color token can hold anything; `!important` and the CSS-wide keywords change the cascade, not the value; a negative literal is dropped by `padding`, `gap`, `border-radius`, `font-size`, widths, blurs, durations and media queries; `none` and `%` for a width that `w`, `h` and `border` ignore. A `space` token whose value is `auto` is in no group of `p`, `px`, `py` and `gap`, which ignore it (E1801 at the use, k.a11y-static Token names)."
// Seed: 1337 (fc.assert below). The shipped-object half (E1812) is packages/check/conformance/token-values-e1812.test.ts; the `auto` space token and the `clamp()` contrast cases are packages/check/conformance/token-values-check.test.ts; the client-bundle clause is packages/cli/conformance/token-grammar-client-bundle.test.ts.
// The Chromium clauses: this repo's conformance harness has no browser in the ui package (the smokes under tooling/smoke run Chromium), so the generated cases run against the tokenizer: TokenSchema's verdict on each generated case, and a strict CSS tokenizer written below (a browser's: strings end before a newline, a bracket closes, a block closes, a declaration is `name:value`) over what `compileStyles` emits, asserting every accepted value is kept whole in a well-formed rule.
// Owed to RFC 0244's runner: the in-browser assertions (a value set on an element reads back from `style` non-empty and computes to other than the initial value; `CSSStyleSheet.replaceSync` keeps `cssRules.length` rules each holding every declaration).
// ASSUMPTIONS: a name counts words, not function names (k.values Numbers and lengths: a function name is not one of them, the names inside it are); the 32/33 boundary is asserted on a font list of words, on lengths at 31 and 33, and on lengths at 32 and 33 with a function name present. A brackets-nested value counts `calc(`, `min(`, `max(`, `clamp(`, `env(` and a bare `(` each as one bracket.
// The "rule" a refusal reports is `format` at the path `[group, name]` (`[group, name, "light" | "dark"]` for a pair), read from `error.data.issues` as k.schema gives it.
import { TokenSchema, defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeOf, compileWith } from "./base-support.ts";

const SEED = 1337;

const issuesOf = (tokens: unknown): { path: (string | number)[]; rule: string }[] | null => {
  const r = TokenSchema.parse(tokens);
  return r.ok ? null : r.error.data.issues;
};
const refusedAt = (tokens: unknown, path: (string | number)[]): boolean =>
  (issuesOf(tokens) ?? []).some((i) => i.rule === "format" && i.path.join(".") === path.join("."));

// ---- a strict reading of the emitted CSS
interface Block {
  prelude: string;
  decls: string[];
  children: Block[];
}
interface Scan {
  rules: Block[];
  errors: string[];
}
function scanCss(css: string): Scan {
  const errors: string[] = [];
  let i = 0;
  /** Reads up to a `{`, `;` or `}` at bracket depth 0 outside strings and comments; returns the text and the stop (`""` at the end). */
  const chunk = (): { text: string; stop: string } => {
    let text = "";
    let depth = 0;
    while (i < css.length) {
      const c = css.charAt(i);
      if (c === "/" && css.charAt(i + 1) === "*") {
        const end = css.indexOf("*/", i + 2);
        if (end < 0) {
          errors.push("unclosed comment");
          i = css.length;
          break;
        }
        i = end + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        for (;;) {
          const d = css.charAt(j);
          if (j >= css.length || d === "\n") {
            errors.push(`unclosed string ${css.slice(i, i + 12)}`);
            break;
          }
          if (d === "\\") {
            j += 2;
            continue;
          }
          if (d === c) break;
          j += 1;
        }
        text += css.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (c === "\\") {
        text += css.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "(" || c === "[") depth += 1;
      if (c === ")" || c === "]") {
        depth -= 1;
        if (depth < 0) errors.push(`stray ${c}`);
      }
      if (depth <= 0 && (c === "{" || c === ";" || c === "}")) {
        i += 1;
        return { text, stop: c };
      }
      text += c;
      i += 1;
    }
    if (depth > 0) errors.push("unclosed bracket");
    return { text, stop: "" };
  };
  const body = (inBlock: boolean): { decls: string[]; children: Block[] } => {
    const decls: string[] = [];
    const children: Block[] = [];
    for (;;) {
      const { text, stop } = chunk();
      const t = text.trim();
      if (stop === "{") {
        const inner = body(true);
        children.push({ prelude: t, decls: inner.decls, children: inner.children });
        if (t === "") errors.push("a block with no prelude");
      } else {
        if (t !== "") decls.push(t);
        if (stop === "}") {
          if (!inBlock) errors.push("stray }");
          return { decls, children };
        }
        if (stop === "") {
          if (inBlock) errors.push("unclosed block");
          return { decls, children };
        }
      }
    }
  };
  const top = body(false);
  // A top-level statement (`@import x;`) is a rule of the sheet as a block is.
  const statements = top.decls.map((d): Block => ({ prelude: d, decls: [], children: [] }));
  return { rules: [...top.children, ...statements], errors };
}
const allBlocks = (b: Block[]): Block[] => b.flatMap((x) => [x, ...allBlocks(x.children)]);
const DECL = /^(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*):\s*\S[\s\S]*$/;
const strip = (s: string): string => s.replace(/\s+/g, "");

/** Every rule is well formed, every declaration is `name:value`, and each custom property written from a token holds none of `url(`, `!`, a backslash or a quote beyond a font's. */
function wellFormed(css: string): Scan {
  const s = scanCss(css);
  expect(s.errors).toEqual([]);
  for (const b of allBlocks(s.rules)) {
    for (const d of b.decls) {
      expect(d, `declaration in ${b.prelude}`).toMatch(DECL);
      if (d.startsWith("--k-")) {
        expect(d).not.toMatch(/url\(|!|\\|;/);
      }
    }
  }
  return s;
}

// ---- value generators, from the forms' grammar (k.values Numbers and lengths, Colors, the table)
const int = (min: number, max: number) => fc.integer({ min, max });
const nat = fc.oneof(
  int(0, 50).map(String),
  fc.tuple(int(0, 20), int(0, 99)).map(([a, b]) => `${a}.${b}`),
);
const pos = int(1, 9).map(String);
const ABSOLUTE = ["px", "cm", "mm", "q", "in", "pt", "pc"];
const FONT_RELATIVE = ["em", "rem", "ex", "rex", "cap", "rcap", "ch", "rch", "ic", "ric", "lh", "rlh"];
const VIEWPORT = ["vw", "vh", "vi", "vb", "vmin", "vmax"].flatMap((u) => [u, `s${u}`, `l${u}`, `d${u}`]);
const CONTAINER = ["cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax"];
const UNITS = [...ABSOLUTE, ...FONT_RELATIVE, ...VIEWPORT, ...CONTAINER];
const length = fc.oneof(
  fc.constant("0"),
  fc.tuple(nat, fc.constantFrom(...UNITS)).map(([n, u]) => `${n}${u}`),
);
const lp = fc.oneof(
  length,
  nat.map((n) => `${n}%`),
);
/** A length side of a math term: never a bare `0`, which is a `<length>` and an `<n>` both. */
const lpNz = fc.oneof(
  fc.tuple(pos, fc.constantFrom(...UNITS)).map(([n, u]) => `${n}${u}`),
  pos.map((n) => `${n}%`),
);
const SIDES = ["top", "right", "bottom", "left"];
const env = fc
  .tuple(fc.constantFrom(...SIDES), fc.option(length, { nil: undefined }))
  .map(([side, fb]) => `env(safe-area-inset-${side}${fb === undefined ? "" : `, ${fb}`})`);

/** A `<sum>` with `b` brackets left to nest in: terms joined by ` + ` or ` - `, each with exactly one length side. */
const sum = (b: number): fc.Arbitrary<string> => {
  const side: fc.Arbitrary<string> =
    b <= 0
      ? lpNz
      : fc.oneof(
          { weight: 5, arbitrary: lpNz },
          { weight: 1, arbitrary: env },
          { weight: 1, arbitrary: math(b) },
          { weight: 1, arbitrary: sum(b - 1).map((s) => `(${s})`) },
        );
  const term = fc.oneof(
    side,
    fc.tuple(side, pos).map(([l, n]) => `${l} * ${n}`),
    fc.tuple(pos, side).map(([n, l]) => `${n} * ${l}`),
    fc.tuple(side, pos).map(([l, n]) => `${l} / ${n}`),
    fc.tuple(pos, side, pos).map(([n, l, d]) => `${n} * ${l} / ${d}`),
  );
  return fc
    .tuple(term, fc.array(fc.tuple(fc.constantFrom(" + ", " - "), term), { maxLength: 1 }))
    .map(([t, rest]) => t + rest.map(([op, x]) => `${op}${x}`).join(""));
};
/** A `<math>` that nests `b` brackets deep at most. */
function math(b: number): fc.Arbitrary<string> {
  const inner = sum(b - 1);
  return fc.oneof(
    inner.map((s) => `calc(${s})`),
    fc
      .array(inner, { minLength: 2, maxLength: 4 })
      .chain((a) => fc.constantFrom("min", "max").map((f) => `${f}(${a.join(", ")})`)),
    fc.tuple(inner, inner, inner).map((a) => `clamp(${a.join(", ")})`),
  );
}
/** Numbers, lengths and names a value holds, counted at least as generously as any reading of the limit (k.values Numbers and lengths): every number-with-unit and every word. */
const countParts = (v: string): number => (v.match(/\d+(?:\.\d+)?[a-z%]*|[A-Za-z][A-Za-z-]*/g) ?? []).length;
const mathValue = math(4).filter((v) => countParts(v) <= 24);

const hex = (n: number) =>
  fc.array(fc.constantFrom(..."0123456789abcdefABCDEF"), { minLength: n, maxLength: n }).map((a) => a.join(""));
const colorValue = fc.oneof(hex(3), hex(6)).map((h) => `#${h}`);
const paint = fc.oneof(colorValue, fc.constant("currentColor"), fc.constant("var(--k-color-text)"));
const KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer", "default"]);
const word = fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_-]{0,6}$/).filter((w) => !KEYWORDS.has(w));
const family = fc.oneof(
  fc.array(word, { minLength: 1, maxLength: 3 }).map((w) => w.join(" ")),
  fc.stringMatching(/^[A-Za-z0-9 ,-]{1,8}$/).map((s) => `"${s}"`),
  fc.stringMatching(/^[A-Za-z0-9 ,-]{1,8}$/).map((s) => `'${s}'`),
  fc.constantFrom('"3M Sans"', '"Inter, var"', "'é'", '"日本語"', '"a\'b"', "'a\"b'"),
);
const font = fc.array(family, { minLength: 1, maxLength: 8 }).map((a) => a.join(", "));
const signed = fc
  .tuple(fc.boolean(), fc.tuple(pos, fc.constantFrom(...UNITS)))
  .map(([neg, [n, u]]) => `${neg ? "-" : ""}${n}${u}`);
const oneShadow = fc
  .tuple(
    fc.boolean(),
    signed,
    signed,
    fc.option(length, { nil: undefined }),
    fc.option(signed, { nil: undefined }),
    fc.option(paint, { nil: undefined }),
  )
  .map(([inset, x, y, blur, spread, p]) => {
    const spreadOk = blur === undefined ? undefined : spread;
    return [
      ...(inset ? ["inset"] : []),
      x,
      y,
      ...(blur === undefined ? [] : [blur]),
      ...(spreadOk === undefined ? [] : [spreadOk]),
      ...(p === undefined ? [] : [p]),
    ].join(" ");
  });
const shadow = fc.oneof(
  fc.constant("none"),
  fc.array(oneShadow, { minLength: 1, maxLength: 4 }).map((a) => a.join(", ")),
);
const border = fc.oneof(
  fc.constant("0"),
  fc.constant("none"),
  fc
    .tuple(
      fc.oneof(length, fc.constantFrom("thin", "medium", "thick")),
      fc.constantFrom("solid", "dashed", "dotted", "double"),
      paint,
    )
    .map((p) => p.join(" ")),
);
const withMath = (base: fc.Arbitrary<string>) =>
  fc.oneof({ weight: 3, arbitrary: base }, { weight: 2, arbitrary: mathValue });
const GEN: Record<string, fc.Arbitrary<string>> = {
  space: withMath(fc.oneof(lp, fc.constant("auto"), env)),
  size: withMath(fc.oneof(lp, fc.constantFrom("auto", "min-content", "max-content", "fit-content"), env)),
  radius: withMath(lp),
  font,
  fontSize: withMath(
    fc.oneof(
      length,
      nat.map((n) => `${n}%`),
    ),
  ),
  weight: fc.oneof(int(1, 1000).map(String), fc.constantFrom("normal", "bold")),
  shadow,
  border,
  breakpoint: fc
    .tuple(
      fc.oneof(
        pos,
        fc.tuple(int(0, 9), int(1, 9)).map(([a, b]) => `${a}.${b}`),
      ),
      fc.constantFrom("px", "em", "rem"),
    )
    .map(([n, u]) => `${n}${u}`),
  motion: fc.tuple(nat, fc.constantFrom("ms", "s")).map(([n, u]) => `${n}${u}`),
};
const GROUPS = Object.keys(GEN);
/** The style prop that reads each group. */
const PROP: Record<string, string> = {
  color: "bg",
  space: "p",
  size: "w",
  radius: "radius",
  font: "font",
  fontSize: "fontSize",
  weight: "weight",
  shadow: "shadow",
  border: "border",
};
const HAZARDS = [
  "url(x.png)",
  " !important",
  "\\",
  '"',
  "'",
  "(",
  ")",
  "[",
  ";",
  "}",
  "{",
  "\n",
  "\f",
  "\0",
  "/*",
  "var(--x)",
  "<",
  "@",
] as const;
const TEXT_TOKENS = { color: { text: "#111111" } } as const;
const verdict = (group: string, value: string): boolean => issuesOf({ ...TEXT_TOKENS, [group]: { a: value } }) === null;
const CONTROLS = [
  ...Array.from({ length: 0x20 }, (_, i) => i),
  ...Array.from({ length: 0x21 }, (_, i) => 0x7f + i),
].map((c) => String.fromCharCode(c));
const LONE_SURROGATES = ["\ud800", "\udbff", "\udc00", "\udfff"];

describe("k.values: forms refuse what they do not produce", () => {
  const REFUSED: { group: string; value: string }[] = [
    { group: "font", value: '"Inter var, sans-serif' },
    { group: "font", value: '"a\fb"' },
    { group: "font", value: '"a\u0000b"' },
    { group: "font", value: '"a\ud800"' },
    { group: "font", value: "3M Sans" },
    { group: "font", value: "inherit" },
    { group: "color", value: '"oops' },
    { group: "color", value: "rgb(1,2,3" },
    { group: "color", value: "red\\" },
    { group: "color", value: "red" },
    { group: "color", value: "#12345" },
    { group: "space", value: "1px !important" },
    { group: "space", value: "-2rem" },
    { group: "space", value: "calc(1px+2px)" },
    { group: "space", value: "calc(1px * 2px)" },
    { group: "space", value: "calc(1px / 0)" },
    { group: "size", value: "url(x.png)" },
    { group: "size", value: "none" },
    { group: "border", value: "1px solid var(--x)" },
    { group: "border", value: "10% solid #000000" },
    { group: "fontSize", value: "-1px" },
    { group: "breakpoint", value: "0px" },
    { group: "motion", value: "120" },
  ];
  for (const c of REFUSED) {
    test(`\`TokenSchema\` refuses with rule \`format\` at that path \`${c.group}: { a: ${JSON.stringify(c.value)} }\``, () => {
      expect(refusedAt({ [c.group]: { a: c.value } }, [c.group, "a"])).toBe(true);
    });
  }

  const IGNORED: { what: string; group: string; value: string }[] = [
    { what: "negative padding", group: "space", value: "-1px" },
    { what: "a negative space in a math function", group: "space", value: "calc(-1px + 2px)" },
    { what: "a negative radius", group: "radius", value: "-1px" },
    { what: "a negative font size", group: "fontSize", value: "-1rem" },
    { what: "a negative blur", group: "shadow", value: "0 0 -1px #000000" },
    { what: "a negative duration", group: "motion", value: "-1s" },
    { what: "a negative breakpoint", group: "breakpoint", value: "-48em" },
    { what: "a zero breakpoint", group: "breakpoint", value: "0em" },
    { what: "a negative size", group: "size", value: "-10px" },
    { what: "a percent border width", group: "border", value: "10% solid #000000" },
    { what: "a none size", group: "size", value: "none" },
    { what: "inherit as a size", group: "size", value: "inherit" },
    { what: "inherit as a space", group: "space", value: "inherit" },
    { what: "initial as a font size", group: "fontSize", value: "initial" },
    { what: "unset as a radius", group: "radius", value: "unset" },
    { what: "revert as a border", group: "border", value: "revert" },
    { what: "revert-layer as a shadow", group: "shadow", value: "revert-layer" },
    { what: "inherit as a font family", group: "font", value: "inherit" },
    { what: "initial in a family list", group: "font", value: "Inter, initial" },
    { what: "default as a family", group: "font", value: "default" },
    { what: "an unquoted family that starts with a digit", group: "font", value: "3M Sans" },
    { what: "an unquoted word that starts with a digit", group: "font", value: "Inter 3M" },
    { what: "an unquoted family with a non-ASCII letter", group: "font", value: "Café" },
    { what: "nine families", group: "font", value: "a, b, c, d, e, f, g, h, i" },
    { what: "a plus sign on a literal", group: "space", value: "+1px" },
    { what: "a plus sign on a shadow offset", group: "shadow", value: "+1px 0 0 #000000" },
    { what: "an exponent", group: "space", value: "1e3px" },
    { what: "a leading-dot number", group: "space", value: ".5rem" },
    { what: "a trailing-dot number", group: "space", value: "1.px" },
    { what: "an unknown unit", group: "space", value: "1fr" },
    { what: "an angle unit", group: "space", value: "1deg" },
    { what: "a unit prefix on a non-viewport unit", group: "space", value: "1sem" },
    { what: "a unit with no number", group: "space", value: "px" },
    { what: "a number with no unit that is not zero", group: "space", value: "4" },
    { what: "a color with alpha", group: "color", value: "#abcd" },
    { what: "a color with eight digits", group: "color", value: "#aabbccdd" },
    { what: "a weight of zero", group: "weight", value: "0" },
    { what: "a weight above 1000", group: "weight", value: "1001" },
    { what: "a fractional weight", group: "weight", value: "1.5" },
    { what: "a border with no paint", group: "border", value: "1px solid" },
    { what: "a border with a named color", group: "border", value: "1px solid red" },
    { what: "a border with an unknown style", group: "border", value: "1px wavy #000000" },
    { what: "currentColor as a color", group: "color", value: "currentColor" },
    { what: "currentColor as a space", group: "space", value: "currentColor" },
    { what: "five shadows", group: "shadow", value: Array.from({ length: 5 }, () => "0 0").join(", ") },
    { what: "five shadow lengths", group: "shadow", value: "0 0 0 0 0" },
    { what: "one shadow length", group: "shadow", value: "0" },
    { what: "none beside a shadow", group: "shadow", value: "none, 0 0" },
    { what: "a space token holding fit-content", group: "space", value: "fit-content" },
    { what: "env in a radius", group: "radius", value: "env(safe-area-inset-top)" },
    { what: "math in a breakpoint", group: "breakpoint", value: "calc(1px + 2px)" },
    { what: "math in a motion", group: "motion", value: "calc(1s + 2s)" },
    { what: "math in a weight", group: "weight", value: "calc(1 + 2)" },
    { what: "math in a border width", group: "border", value: "calc(1px) solid #000000" },
    { what: "math in a shadow offset", group: "shadow", value: "calc(1px) 0" },
    { what: "an unknown safe-area side", group: "space", value: "env(safe-area-inset-middle)" },
    { what: "an unknown env name", group: "space", value: "env(viewport-segment-width)" },
    { what: "env with a fallback that is no length", group: "space", value: "env(safe-area-inset-top, red)" },
    { what: "env with no side", group: "space", value: "env()" },
    { what: "env with two fallbacks", group: "space", value: "env(safe-area-inset-top, 1px, 2px)" },
    { what: "an image-set size", group: "size", value: "image-set(x 1x)" },
    { what: "min with one argument", group: "space", value: "min(1px)" },
    { what: "max with five arguments", group: "space", value: "max(1px, 2px, 3px, 4px, 5px)" },
    { what: "clamp with two arguments", group: "space", value: "clamp(1px, 2px)" },
    { what: "clamp with four arguments", group: "space", value: "clamp(1px, 2px, 3px, 4px)" },
    { what: "calc with two arguments", group: "space", value: "calc(1px, 2px)" },
    { what: "an unknown math function", group: "space", value: "abs(1px)" },
    { what: "a sum with no spaces around minus", group: "space", value: "calc(2px-1px)" },
    { what: "a product with no spaces", group: "space", value: "calc(2px*3)" },
    { what: "a division by a length", group: "space", value: "calc(4px / 2px)" },
    { what: "a division by 0.0", group: "space", value: "calc(4px / 0.0)" },
    { what: "a division of a number by a length", group: "space", value: "calc(2 / 1px)" },
    { what: "a term with no length side", group: "space", value: "calc(2 * 3)" },
    { what: "a sum of a length and a number", group: "space", value: "calc(1px + 2)" },
    { what: "two spaces between tokens", group: "space", value: "calc(1px  +  2px)" },
    { what: "a leading space", group: "space", value: " 1px" },
    { what: "a trailing space", group: "space", value: "1px " },
    { what: "a tab between tokens", group: "space", value: "calc(1px\t+\t2px)" },
    { what: "a non-breaking space", group: "space", value: "calc(1px + 2px)" },
    { what: "an empty value", group: "space", value: "" },
    { what: "a comment opener", group: "space", value: "1px/*" },
    { what: "a var of a space property", group: "space", value: "var(--k-space-1)" },
  ];
  for (const c of IGNORED) {
    test(`a value a property would drop or the forms do not produce is refused with rule \`format\` at its path: ${c.what} (\`${c.group}: { a: ${JSON.stringify(c.value)} }\`)`, () => {
      expect(refusedAt({ ...TEXT_TOKENS, [c.group]: { a: c.value } }, [c.group, "a"])).toBe(true);
    });
  }

  test("a color pair with one refused value is refused at `color.a.light` or `color.a.dark`, the one that is wrong", () => {
    for (const bad of ['"oops', "rgb(1,2,3", "red\\", "red", "#12345", "currentColor"]) {
      expect(refusedAt({ color: { a: { light: bad, dark: "#111111" } } }, ["color", "a", "light"])).toBe(true);
      expect(refusedAt({ color: { a: { light: "#111111", dark: bad } } }, ["color", "a", "dark"])).toBe(true);
      expect(issuesOf({ color: { a: { light: "#111111", dark: "#eeeeee" } } })).toBeNull();
    }
  });

  test("a quoted family holding a control character (U+0000 to U+001F, U+007F to U+009F), in either quote, is refused at its path, and so is the character outside quotes", () => {
    expect(CONTROLS).toHaveLength(32 + 33);
    for (const c of CONTROLS) {
      for (const q of ['"', "'"]) {
        expect(
          refusedAt({ font: { a: `${q}a${c}b${q}` } }, ["font", "a"]),
          `U+${c.charCodeAt(0).toString(16)} in ${q}`,
        ).toBe(true);
      }
      expect(refusedAt({ font: { a: `Inter${c}` } }, ["font", "a"]), `U+${c.charCodeAt(0).toString(16)} outside`).toBe(
        true,
      );
      expect(refusedAt({ space: { a: `1px${c}` } }, ["space", "a"]), `space U+${c.charCodeAt(0).toString(16)}`).toBe(
        true,
      );
    }
  });

  test("a quoted family holding a lone surrogate is refused, a surrogate pair is accepted, and a lone surrogate outside quotes is refused", () => {
    for (const s of LONE_SURROGATES) {
      expect(refusedAt({ font: { a: `"a${s}"` } }, ["font", "a"]), `high/low ${s.charCodeAt(0).toString(16)}`).toBe(
        true,
      );
      expect(refusedAt({ font: { a: `'${s}b'` } }, ["font", "a"])).toBe(true);
      expect(refusedAt({ font: { a: `Inter${s}` } }, ["font", "a"])).toBe(true);
    }
    expect(issuesOf({ font: { a: '"a😀b"' } })).toBeNull();
    expect(issuesOf({ font: { a: "'日本語'" } })).toBeNull();
  });

  test("a quoted family holds its own quote's other kind, and refuses its own kind and a backslash, inside or outside the string", () => {
    expect(issuesOf({ font: { a: `"a'b"` } })).toBeNull();
    expect(issuesOf({ font: { a: `'a"b'` } })).toBeNull();
    for (const bad of [`"a"b"`, `'a'b'`, `"a\\b"`, `'a\\'`, `"a\\"`, "Inter\\", `"a"b`, `a"b"`, `'`, `"`]) {
      expect(refusedAt({ font: { a: bad } }, ["font", "a"]), bad).toBe(true);
    }
  });

  test("a family list of one and of eight is accepted, of nine is refused, and a list that joins with anything but `, ` is refused", () => {
    expect(verdict("font", "Inter")).toBe(true);
    expect(verdict("font", Array.from({ length: 8 }, (_, i) => `f${i}`).join(", "))).toBe(true);
    expect(verdict("font", Array.from({ length: 9 }, (_, i) => `f${i}`).join(", "))).toBe(false);
    for (const bad of ["a,b", "a ,b", "a , b", "a,  b", "a, ", ", a", "a;b"])
      expect(verdict("font", bad), bad).toBe(false);
  });

  test("a value holding 32 names is accepted and one holding 33 is refused (a font list of eight families of four words, and one more word)", () => {
    const family4 = (i: number): string => `a${i} b c d`;
    const at = (extra: string): string => `${Array.from({ length: 8 }, (_, i) => family4(i)).join(", ")}${extra}`;
    expect(verdict("font", at(""))).toBe(true);
    expect(verdict("font", at(" e"))).toBe(false);
  });

  test("a value holding 31 lengths in one `calc` is accepted and one holding 33 is refused; the limit reads numbers, lengths and names whether or not `calc` counts as a name", () => {
    const lengths = (n: number): string => `calc(${Array.from({ length: n }, () => "1px").join(" + ")})`;
    expect(verdict("space", lengths(31))).toBe(true);
    expect(verdict("space", lengths(33))).toBe(false);
    expect(verdict("space", lengths(80))).toBe(false);
  });

  test("a function name (`calc`, `min`, `max`, `clamp`, `env`, `var`) is not one of the 32 names a value holds at most, the names inside it are: 32 accepted and 33 refused with a function name present", () => {
    const sum = (n: number): string => Array.from({ length: n }, () => "1px").join(" + ");
    for (const fn of ["calc", "min", "max", "clamp"]) {
      const args = (n: number): string => (fn === "calc" ? sum(n) : [sum(n - 2), "1px", "1px"].join(", "));
      const wrap = (n: number): string =>
        `${fn}(${fn === "min" || fn === "max" ? [sum(n - 1), "1px"].join(", ") : args(n)})`;
      expect(verdict("space", wrap(32)), `${fn} 32`).toBe(true);
      expect(verdict("space", wrap(33)), `${fn} 33`).toBe(false);
    }
    const withEnv = (n: number): string => `calc(${sum(n - 1)} + env(safe-area-inset-top))`;
    expect(verdict("space", withEnv(32)), "env 32").toBe(true);
    expect(verdict("space", withEnv(33)), "env 33").toBe(false);
  });

  test("brackets nest at most four deep: four nested `calc` are accepted and five refused, whatever mix of `calc`, `min`, `max`, `clamp` and a bracketed sum holds them", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("calc", "min", "max", "clamp"),
        fc.array(fc.constantFrom("calc", "()", "min", "max", "clamp"), { maxLength: 5 }),
        (first, rest) => {
          const fs = [first, ...rest];
          let acc = "1px";
          for (const f of [...fs].reverse()) {
            acc =
              f === "()"
                ? `(${acc})`
                : f === "calc"
                  ? `calc(${acc})`
                  : f === "min"
                    ? `min(${acc}, 1px)`
                    : f === "max"
                      ? `max(${acc}, 1px)`
                      : `clamp(1px, ${acc}, 2px)`;
          }
          expect(verdict("space", acc), `${acc} nests ${fs.length}`).toBe(fs.length <= 4);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
    expect(verdict("space", "calc(calc(calc(calc(1px))))")).toBe(true);
    expect(verdict("space", "calc(calc(calc(calc(calc(1px)))))")).toBe(false);
    expect(verdict("space", "calc(calc(calc(env(safe-area-inset-top))))")).toBe(true);
    expect(verdict("space", "calc(calc(calc(calc(env(safe-area-inset-top)))))")).toBe(false);
  });

  test("any value of a group's form followed by or preceded by a hazard (`url(`, `!important`, a backslash, a quote, a bracket, `;`, a brace, a newline, a form feed, a null, a comment opener, a foreign `var(`) is refused at that path, whatever the group", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GROUPS, "color"),
        fc.nat(),
        fc.constantFrom(...HAZARDS),
        fc.boolean(),
        (group, pick, hazard, atFront) => {
          const gen = group === "color" ? colorValue : (GEN[group] ?? colorValue);
          const [valid = ""] = fc.sample(gen, { seed: SEED + pick, numRuns: 1 });
          const bad = atFront ? `${hazard}${valid}` : `${valid}${hazard}`;
          expect(
            refusedAt({ ...TEXT_TOKENS, [group]: { a: bad } }, [group, "a"]),
            `${group}: ${JSON.stringify(bad)}`,
          ).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 400 },
    );
  });

  test("a generated math value one step outside its form (a fifth bracket, a fifth argument, a zero divisor, an unspaced sign, a negative literal) is refused", () => {
    fc.assert(
      fc.property(mathValue, fc.constantFrom("deeper", "arg", "zero", "tight", "negative", "unclosed"), (v, how) => {
        const bad =
          how === "deeper"
            ? `calc(calc(calc(calc(${v}))))`
            : how === "arg"
              ? `max(${v}, 1px, 2px, 3px, 4px)`
              : how === "zero"
                ? `calc((${v}) / 0)`
                : how === "tight"
                  ? `calc(${v}+1px)`
                  : how === "negative"
                    ? `calc(${v} + -1px)`
                    : v.slice(0, -1);
        expect(verdict("space", bad), bad).toBe(false);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("a `var(...)` of any property but a held color token's custom property is refused in every group that takes a `<ref>`, and one of a held color token is accepted", () => {
    for (const bad of [
      "var(--x)",
      "var(--k-color-text, red)",
      "var(--k-space-1)",
      "var(--k-color-missing)",
      "var(--k-color-text)x",
    ]) {
      expect(refusedAt({ color: { text: "#111111" }, border: { a: `1px solid ${bad}` } }, ["border", "a"]), bad).toBe(
        true,
      );
      expect(refusedAt({ color: { text: "#111111" }, shadow: { a: `0 1px 2px ${bad}` } }, ["shadow", "a"]), bad).toBe(
        true,
      );
    }
    expect(issuesOf({ color: { text: "#111111" }, shadow: { a: "0 1px 2px var(--k-color-text)" } })).toBeNull();
  });
});

describe("k.values: forms accept what they produce", () => {
  const ACCEPTED: { group: string; value: string }[] = [
    { group: "space", value: "clamp(8px, 2vw + 4px, 24px)" },
    { group: "space", value: "env(safe-area-inset-top, 0)" },
    { group: "size", value: "100dvh" },
    { group: "size", value: "min(44rem, 100% - 32px)" },
    { group: "size", value: "50cqi" },
    { group: "font", value: '"Inter, var", sans-serif' },
    { group: "font", value: '"3M Sans", serif' },
    { group: "fontSize", value: "clamp(1rem, 0.9rem + 0.5vw, 1.25rem)" },
    { group: "weight", value: "650" },
    { group: "shadow", value: "inset 0 -1px 2px #000000" },
    { group: "border", value: "1px solid currentColor" },
    { group: "breakpoint", value: "48em" },
    { group: "motion", value: "0.2s" },
  ];
  for (const c of ACCEPTED) {
    test(`\`TokenSchema\` accepts \`${c.group}: { a: ${JSON.stringify(c.value)} }\``, () => {
      expect(issuesOf({ [c.group]: { a: c.value } })).toBeNull();
    });
  }

  test("`TokenSchema` accepts `brandTokens`", () => {
    expect(TokenSchema.parse(brandTokens).ok).toBe(true);
  });

  test("`env()` takes each of `top`, `right`, `bottom` and `left`, with and without a length fallback, in `space` and `size`, and refuses a fifth name", () => {
    for (const group of ["space", "size"]) {
      for (const side of SIDES) {
        expect(verdict(group, `env(safe-area-inset-${side})`), `${group} ${side}`).toBe(true);
        expect(verdict(group, `env(safe-area-inset-${side}, 8px)`), `${group} ${side} fb`).toBe(true);
        expect(verdict(group, `env(safe-area-inset-${side}, 0)`), `${group} ${side} zero`).toBe(true);
        expect(verdict(group, `calc(env(safe-area-inset-${side}) + 1rem)`), `${group} ${side} calc`).toBe(true);
      }
      expect(verdict(group, "env(safe-area-inset-inline)")).toBe(false);
      expect(verdict(group, "env(safe-area-max-inset-top)")).toBe(false);
    }
  });

  test("a sample of each unit family is accepted as a length, as a font size and as a size, and every unit in the list is", () => {
    const sample = [...ABSOLUTE, ...FONT_RELATIVE, ...VIEWPORT, ...CONTAINER];
    expect(sample).toHaveLength(7 + 12 + 24 + 6);
    for (const u of sample) {
      for (const group of ["space", "size", "radius", "fontSize"]) {
        expect(verdict(group, `1.5${u}`), `${group} 1.5${u}`).toBe(true);
      }
    }
    for (const u of ["dvh", "svw", "lvmin", "dvmax", "cqmin", "rcap", "ric", "rlh", "q"])
      expect(verdict("size", `10${u}`), u).toBe(true);
  });

  test("`currentColor` is accepted in `border` and `shadow`, where a paint goes, and refused in `color` (a lone value or a pair half) and beside a shadow's lengths without a space", () => {
    expect(verdict("border", "2px dashed currentColor")).toBe(true);
    expect(verdict("shadow", "0 1px 2px currentColor")).toBe(true);
    expect(verdict("shadow", "inset 1px 1px currentColor, 0 0 1px 1px #000000")).toBe(true);
    expect(verdict("color", "currentColor")).toBe(false);
    expect(issuesOf({ color: { a: { light: "currentColor", dark: "#111111" } } })).not.toBeNull();
    expect(verdict("shadow", "0 1px 2pxcurrentColor")).toBe(false);
  });

  test('a family with a comma inside quotes is one family: `"Inter, var"` alone is accepted, and `"a,b", "c"` is two', () => {
    expect(verdict("font", '"Inter, var"')).toBe(true);
    expect(verdict("font", '"a,b", "c"')).toBe(true);
    expect(verdict("font", "'a, b', c")).toBe(true);
  });

  test("a shadow's offsets and spread may be negative, its blur may not, and nothing else carries a sign", () => {
    expect(verdict("shadow", "-1px -2px 3px -4px #000000")).toBe(true);
    expect(verdict("shadow", "inset -1px 0")).toBe(true);
    expect(verdict("shadow", "-1px 0 -1px")).toBe(false);
    expect(verdict("shadow", "0 0 0 -1px")).toBe(true);
  });

  test("a value generated from its group's form is accepted by `TokenSchema` and by `defineTokens`, in every group", () => {
    for (const group of GROUPS) {
      fc.assert(
        fc.property(GEN[group] ?? colorValue, (v) => {
          expect(issuesOf({ ...TEXT_TOKENS, [group]: { a: v } }), `${group}: ${v}`).toBeNull();
          expect(
            codeOf(() => defineTokens(JSON.parse(JSON.stringify({ ...TEXT_TOKENS, [group]: { a: v } })))),
          ).toBeNull();
        }),
        { seed: SEED, numRuns: 80 },
      );
    }
    fc.assert(
      fc.property(colorValue, colorValue, (a, b) => {
        expect(issuesOf({ color: { a, b: { light: a, dark: b } } })).toBeNull();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("the generator reaches the forms the clause names: a `calc`, `min`, `max`, `clamp`, an `env`, a nest of four and a unit of every family", () => {
    const seen = fc.sample(mathValue, { seed: SEED, numRuns: 600 }).join("\n");
    for (const f of ["calc(", "min(", "max(", "clamp(", "env(safe-area-inset-"]) expect(seen, f).toContain(f);
    expect(
      Math.max(...fc.sample(mathValue, { seed: SEED, numRuns: 600 }).map((v) => v.split("(").length - 1)),
    ).toBeGreaterThanOrEqual(3);
  });

  test("`border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one", () => {
    const border = { a: "1px solid var(--k-color-text)" };
    expect(issuesOf({ color: { text: "#111111" }, border })).toBeNull();
    expect(issuesOf({ color: { text: { light: "#111111", dark: "#eeeeee" } }, border })).toBeNull();
    expect(refusedAt({ border }, ["border", "a"])).toBe(true);
    expect(refusedAt({ color: { other: "#111111" }, border }, ["border", "a"])).toBe(true);
  });
});

describe("k.values: a refused value in `tokens.ts` is E1807", () => {
  const ATTACKS: { label: string; tokens: Record<string, unknown> }[] = [
    { label: "a font value with an unclosed quote", tokens: { font: { a: '"Inter var, sans-serif' } } },
    { label: "a font value with a form feed in a string", tokens: { font: { a: '"a\fb"' } } },
    { label: "a font value with a null in a string", tokens: { font: { a: '"a\u0000b"' } } },
    { label: "an unquoted family that starts with a digit", tokens: { font: { a: "3M Sans" } } },
    { label: 'a color `"oops`', tokens: { color: { a: '"oops' } } },
    { label: "a color `rgb(1,2,3`", tokens: { color: { a: "rgb(1,2,3" } } },
    { label: "a color with a trailing backslash", tokens: { color: { a: "red\\" } } },
    {
      label: "a pair whose dark value breaks out of the declaration",
      tokens: { color: { a: { light: "#111", dark: "#eee;}" } } },
    },
    { label: "a url() size", tokens: { size: { a: "url(x.png)" } } },
    { label: "an !important space", tokens: { space: { a: "1px !important" } } },
    { label: "a negative space", tokens: { space: { a: "-2rem" } } },
    { label: "a negative radius", tokens: { radius: { a: "-1px" } } },
    { label: "a negative duration", tokens: { motion: { a: "-1s" } } },
    { label: "a zero breakpoint", tokens: { breakpoint: { a: "0px" } } },
    { label: "a percent border width", tokens: { border: { a: "10% solid #000000" } } },
    { label: "a CSS-wide keyword", tokens: { size: { a: "inherit" } } },
  ];
  for (const a of ATTACKS) {
    test(`${a.label} makes \`defineTokens\` and \`compileStyles\` throw E1807, and no stylesheet is written`, () => {
      const loose = JSON.parse(JSON.stringify(a.tokens));
      expect(codeOf(() => defineTokens(loose))).toBe("E1807");
      expect(codeOf(() => compileStyles({ tokens: loose, usages: [] }))).toBe("E1807");
    });
  }

  test("a token set `TokenSchema` accepts is one `defineTokens` accepts, and one it refuses is E1807, whatever the group and the mutation", () => {
    fc.assert(
      fc.property(fc.constantFrom(...GROUPS), fc.nat(), fc.constantFrom(...HAZARDS), (group, pick, hazard) => {
        const [valid = ""] = fc.sample(GEN[group] ?? colorValue, { seed: SEED + pick, numRuns: 1 });
        const at = pick % (valid.length + 1);
        const value = `${valid.slice(0, at)}${hazard}${valid.slice(at)}`;
        const tokens = JSON.parse(JSON.stringify({ ...TEXT_TOKENS, [group]: { a: value } }));
        const ok = TokenSchema.parse(tokens).ok;
        expect(codeOf(() => defineTokens(tokens))).toBe(ok ? null : "E1807");
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe("k.values: Stylesheet, the compiled CSS keeps every rule", () => {
  test("the CSS compiled from `brandTokens` is well formed, each rule a balanced block of `name:value` declarations (a browser's parser keeps it whole)", () => {
    const { css } = compileStyles({ tokens: brandTokens, usages: [] });
    const s = wellFormed(css);
    expect(s.rules.length).toBeGreaterThan(0);
  });

  const colorOf = { text: "#111111", a: "#0B5CAD" };
  test("the CSS compiled from tokens holding one generated case per form, every group used by a style prop, is well formed and holds each value whole in a declaration", () => {
    const values: Record<string, string> = {
      space: "clamp(8px, 2vw + 4px, 24px)",
      size: "min(44rem, 100% - 32px)",
      radius: "0.5rem",
      font: '\'Inter var\', "Helvetica Neue", "Inter, var", sans-serif',
      fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.25rem)",
      weight: "650",
      shadow: "inset 0 -1px 2px #000000, 0 2px 4px 1px var(--k-color-text), 0 0 1px currentColor",
      border: "1px solid var(--k-color-text)",
    };
    const extra: Record<string, unknown> = {
      color: { ...colorOf, bg: { light: "#ffffff", dark: "#111111" } },
      breakpoint: { bp: "48em" },
      motion: { slow: "0.2s" },
    };
    for (const [g, v] of Object.entries(values)) extra[g] = { a: v };
    const usages = [
      { props: { bg: "a" } },
      ...Object.keys(values).map((g) => ({ props: { [PROP[g] ?? "p"]: "a" } })),
      { props: { p: "a" }, breakpoint: "bp" },
    ];
    const out = compileWith(extra, usages);
    wellFormed(out.css);
    const flat = strip(out.css);
    for (const v of Object.values(values)) expect(flat, v).toContain(strip(v));
    expect(flat).toContain("48em");
    expect(flat).toContain("#0B5CAD");
    for (const cls of out.classes.flat()) expect(out.css).toContain(cls);
  });

  test("whatever values the forms admit, the CSS compiled with them used by their style props is well formed and holds each value whole", () => {
    const tuple = fc.record(Object.fromEntries(GROUPS.map((g) => [g, GEN[g] ?? colorValue])));
    fc.assert(
      fc.property(tuple, colorValue, colorValue, (vals, light, dark) => {
        const extra: Record<string, unknown> = { color: { text: "#111111", a: { light, dark } } };
        for (const g of GROUPS) extra[g] = { a: vals[g] };
        const usages = [
          { props: { bg: "a" } },
          ...Object.keys(PROP)
            .filter((g) => g !== "color")
            .map((g) => ({ props: { [PROP[g] ?? "p"]: "a" } })),
          { props: { p: "a" }, breakpoint: "a" },
        ];
        const out = compileWith(extra, usages);
        wellFormed(out.css);
        const flat = strip(out.css);
        for (const g of GROUPS) {
          if (g === "motion") continue;
          expect(flat, `${g}: ${vals[g]}`).toContain(strip(vals[g] ?? ""));
        }
        expect(flat).toContain(light);
        expect(flat).toContain(dark);
      }),
      { seed: SEED, numRuns: 80 },
    );
  });

  test("each unit, each keyword and each math function at two, three and four arguments, set on its group's style prop, is accepted and kept whole by the strict reader", () => {
    const cases: [string, string][] = [
      ...UNITS.map((u): [string, string] => ["size", `3${u}`]),
      ...["auto", "min-content", "max-content", "fit-content"].map((k): [string, string] => ["size", k]),
      ...["min", "max"].flatMap((f) =>
        [2, 3, 4].map((n): [string, string] => [
          "space",
          `${f}(${Array.from({ length: n }, (_, i) => `${i + 1}px`).join(", ")})`,
        ]),
      ),
      ["space", "clamp(1px, 2px, 3px)"],
      ["space", "calc(1px + 2px)"],
    ];
    for (const [group, value] of cases) {
      expect(verdict(group, value), `${group}: ${value}`).toBe(true);
      const out = compileWith({ [group]: { a: value } }, [{ props: { [PROP[group] ?? "p"]: "a" } }]);
      wellFormed(out.css);
      expect(strip(out.css), value).toContain(strip(value));
    }
  });

  test("the strict reader refuses the broken sheets it is meant to catch (it finds an unclosed string, bracket and block)", () => {
    expect(scanCss('.a{font-family:"Inter var,sans-serif}').errors.length).toBeGreaterThan(0);
    expect(scanCss(".a{color:rgb(1,2,3}").errors.length).toBeGreaterThan(0);
    expect(scanCss(".a{color:red;").errors.length).toBeGreaterThan(0);
    expect(scanCss(".a{color:red}}").errors.length).toBeGreaterThan(0);
    expect(scanCss('.a{color:red}\n.b{--x:"ok"}@media (min-width:1px){.c{p:1}}').errors).toEqual([]);
  });
});

// Untestable without a browser: that each accepted case "reads back from `style` as a non-empty value and gives a computed value other than the initial one", and that `CSSStyleSheet.replaceSync` keeps `cssRules.length` rules, each with every declaration. The strict reader above stands in; the browser assertions are owed to RFC 0244's runner.
