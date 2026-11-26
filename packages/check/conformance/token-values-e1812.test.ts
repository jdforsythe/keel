// Spec: k.values, clause "A shipped `acmeTokens` holding `font: { 'acme.f': '\"Inter' }` is one E1812 with message `acmeTokens fails TokenSchema at font.acme.f`."
// Spec: k.values, clause "A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `light` or `dark` after it for a pair): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks). Refused, and why: `url(...)` and `image-set(...)` reach outside the stylesheet; a `var(...)` of anything but a held color token can hold anything; `!important` and the CSS-wide keywords change the cascade, not the value; a negative literal is dropped by `padding`, `gap`, `border-radius`, `font-size`, widths, blurs, durations and media queries; `none` and `%` for a width that `w`, `h` and `border` ignore. A `space` token whose value is `auto` is in no group of `p`, `px`, `py` and `gap`, which ignore it (E1801 at the use, k.a11y-static Token names)."
// Seed: 1337 (fc.assert below). The app half (E1807 from `tokens.ts`, as `defineTokens` and `compileStyles` throw it) is packages/ui/conformance/token-values.test.ts.
// ASSUMPTIONS: see library-looks-support.ts. `<path>` joins the issue path with dots, a library name keeping its own dot (`font.acme.f`, `color.acme.accent.light`). A shipped value is written as a JSON string literal in the shipped file's source, so its text is the attack's characters. The diagnostic's position is not asserted (the spec gives none beyond the file).
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, SHIPPED, app, codesOf, composed, fixedTokens } from "./library-looks-support.ts";

const FIXED = fixedTokens();
const shipped = (body: string): string =>
  `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ ${body} })\n`;
const e1812 = (source: string) => codesOf(app(FIXED, [{ path: SHIPPED, source }]), "E1812", composed());
const lit = (v: string): string => JSON.stringify(v);

test(
  "A shipped `acmeTokens` holding `font: { 'acme.f': '\"Inter' }` is one E1812 with message `acmeTokens fails TokenSchema at font.acme.f`",
  () => {
    const d = e1812(shipped(`font: { 'acme.f': '"Inter' }`));
    expect(d.map((x) => x.message)).toEqual(["acmeTokens fails TokenSchema at font.acme.f"]);
    expect(d[0]?.path).toBe(SHIPPED);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

const ATTACKS: { label: string; body: string; at: string }[] = [
  {
    label: "a font value with an unclosed quote",
    body: `font: { 'acme.f': ${lit('"Inter var, sans-serif')} }`,
    at: "font.acme.f",
  },
  { label: 'a color `"oops`', body: `color: { 'acme.c': ${lit('"oops')} }`, at: "color.acme.c" },
  { label: "a color `rgb(1,2,3`", body: `color: { 'acme.c': ${lit("rgb(1,2,3")} }`, at: "color.acme.c" },
  { label: "a color with a trailing backslash", body: `color: { 'acme.c': ${lit("red\\")} }`, at: "color.acme.c" },
  {
    label: "a pair whose dark value is a name",
    body: `color: { 'acme.c': { light: '#111111', dark: 'red' } }`,
    at: "color.acme.c.dark",
  },
  {
    label: "a pair whose light value is five hex digits",
    body: `color: { 'acme.c': { light: '#12345', dark: '#111111' } }`,
    at: "color.acme.c.light",
  },
  { label: "a url() size", body: `size: { 'acme.s': 'url(x.png)' }`, at: "size.acme.s" },
  { label: "a border with a foreign var()", body: `border: { 'acme.b': '1px solid var(--x)' }`, at: "border.acme.b" },
  { label: "a motion with no unit", body: `motion: { 'acme.m': '120' }`, at: "motion.acme.m" },
];
for (const a of ATTACKS) {
  test(
    `${a.label} in a shipped object is one E1812 \`acmeTokens fails TokenSchema at ${a.at}\``,
    () => {
      const d = e1812(shipped(a.body));
      expect(d.map((x) => x.message)).toEqual([`acmeTokens fails TokenSchema at ${a.at}`]);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );
}

test(
  "a shipped value followed by any hazard (`url(`, `!important`, a backslash, a quote, an open bracket, `;`, a brace) is one E1812 at its path, in every group",
  () => {
    const hazards = ["url(x.png)", " !important", "\\", '"', "'", "(", ";", "}", "{"];
    const groups: [string, string][] = [
      ["color", "#0B5CAD"],
      ["space", "8px"],
      ["size", "4rem"],
      ["radius", "2px"],
      ["fontSize", "1rem"],
      ["weight", "600"],
      ["breakpoint", "48em"],
      ["motion", "120ms"],
      ["font", "Inter"],
    ];
    fc.assert(
      fc.property(fc.constantFrom(...groups), fc.constantFrom(...hazards), ([group, valid], hazard) => {
        const d = e1812(shipped(`${group}: { 'acme.a': ${lit(`${valid}${hazard}`)} }`));
        expect(d.map((x) => x.message)).toEqual([`acmeTokens fails TokenSchema at ${group}.acme.a`]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "a shipped object whose values are in form, a `border` naming the object's own color token among them, is no E1812",
  () => {
    const body = `color: { 'acme.accent': '#0B5CAD' }, border: { 'acme.edge': '1px solid var(--k-color-acme-accent)' }, font: { 'acme.f': "'Inter var', sans-serif" }, shadow: { 'acme.sh': 'inset 0 1px 2px #000000' }`;
    expect(e1812(shipped(body))).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

// ---- the k.values forms in a shipped object (rfc:0243 second review)
const MORE: { label: string; body: string; at: string }[] = [
  { label: "a form feed in a quoted family", body: `font: { 'acme.f': ${lit('"a\fb"')} }`, at: "font.acme.f" },
  { label: "a null in a quoted family", body: `font: { 'acme.f': ${lit('"a\u0000b"')} }`, at: "font.acme.f" },
  { label: "a lone surrogate in a quoted family", body: `font: { 'acme.f': ${lit('"a\ud800"')} }`, at: "font.acme.f" },
  { label: "a backslash in a quoted family", body: `font: { 'acme.f': ${lit('"a\\b"')} }`, at: "font.acme.f" },
  {
    label: "an unquoted family that starts with a digit (`3M Sans`)",
    body: `font: { 'acme.f': '3M Sans' }`,
    at: "font.acme.f",
  },
  { label: "a CSS-wide keyword family (`inherit`)", body: `font: { 'acme.f': 'inherit' }`, at: "font.acme.f" },
  { label: "a negative space", body: `space: { 'acme.s': '-2rem' }`, at: "space.acme.s" },
  { label: "a negative radius", body: `radius: { 'acme.r': '-1px' }`, at: "radius.acme.r" },
  { label: "a negative font size", body: `fontSize: { 'acme.z': '-1px' }`, at: "fontSize.acme.z" },
  { label: "a negative blur", body: `shadow: { 'acme.sh': '0 0 -1px #000000' }`, at: "shadow.acme.sh" },
  { label: "a negative duration", body: `motion: { 'acme.m': '-1s' }`, at: "motion.acme.m" },
  { label: "a zero breakpoint", body: `breakpoint: { 'acme.b': '0px' }`, at: "breakpoint.acme.b" },
  { label: "a percent border width", body: `border: { 'acme.b': '10% solid #000000' }`, at: "border.acme.b" },
  { label: "a none size", body: `size: { 'acme.s': 'none' }`, at: "size.acme.s" },
  { label: "a `calc` that multiplies two lengths", body: `space: { 'acme.s': 'calc(1px * 2px)' }`, at: "space.acme.s" },
  { label: "a `calc` that divides by zero", body: `space: { 'acme.s': 'calc(1px / 0)' }`, at: "space.acme.s" },
  { label: "five nested `calc`", body: `space: { 'acme.s': 'calc(calc(calc(calc(calc(1px)))))' }`, at: "space.acme.s" },
  { label: "an unknown `env` name", body: `space: { 'acme.s': 'env(safe-area-inset-middle)' }`, at: "space.acme.s" },
];
for (const a of MORE) {
  test(
    `${a.label} in a shipped object is one E1812 \`acmeTokens fails TokenSchema at ${a.at}\``,
    () => {
      const d = e1812(shipped(a.body));
      expect(d.map((x) => x.message)).toEqual([`acmeTokens fails TokenSchema at ${a.at}`]);
      expect(d[0]?.path).toBe(SHIPPED);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );
}

test(
  "a shipped object whose values use the grammar's forms (math functions, `env()`, every unit family, a family with a comma, `currentColor`, a signed shadow offset) is no E1812",
  () => {
    const body = [
      `space: { 'acme.s': 'clamp(8px, 2vw + 4px, 24px)', 'acme.e': 'env(safe-area-inset-top, 0)' }`,
      `size: { 'acme.h': '100dvh', 'acme.c': '50cqi', 'acme.m': 'min(44rem, 100% - 32px)' }`,
      `font: { 'acme.f': '"Inter, var", sans-serif', 'acme.g': '"3M Sans", serif' }`,
      `fontSize: { 'acme.z': 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)' }`,
      `border: { 'acme.b': '1px solid currentColor' }`,
      `shadow: { 'acme.sh': '-1px -2px 3px -4px currentColor' }`,
    ].join(", ");
    expect(e1812(shipped(body))).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "a shipped value in each unit family (absolute, font-relative, viewport with `s`, `l` and `d`, container) is no E1812, and the same value with a hazard appended is one",
  () => {
    const units = ["cm", "rex", "svh", "lvw", "dvmin", "cqmax", "q", "ric"];
    fc.assert(
      fc.property(fc.constantFrom(...units), fc.constantFrom("-", "+", "!important", "\\", "(", "e3"), (u, mark) => {
        expect(e1812(shipped(`size: { 'acme.a': ${lit(`4${u}`)} }`))).toEqual([]);
        const d = e1812(
          shipped(
            `size: { 'acme.a': ${lit(`${mark === "-" || mark === "+" ? mark : ""}4${u}${mark === "-" || mark === "+" ? "" : mark}`)} }`,
          ),
        );
        expect(d.map((x) => x.message)).toEqual(["acmeTokens fails TokenSchema at size.acme.a"]);
      }),
      { seed: SEED, numRuns: 8 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "a shipped quoted family holding any control character (U+0000 to U+001F, U+007F to U+009F) or a lone surrogate is one E1812; the same family without it is none",
  () => {
    const bad = [0x00, 0x08, 0x0a, 0x0c, 0x1f, 0x7f, 0x85, 0x9f].map((c) => String.fromCharCode(c));
    fc.assert(
      fc.property(fc.constantFrom(...bad, "\ud800", "\udfff"), fc.constantFrom('"', "'"), (c, q) => {
        const d = e1812(shipped(`font: { 'acme.f': ${lit(`${q}a${c}b${q}`)} }`));
        expect(d.map((x) => x.message)).toEqual(["acmeTokens fails TokenSchema at font.acme.f"]);
        expect(e1812(shipped(`font: { 'acme.f': ${lit(`${q}ab${q}`)} }`))).toEqual([]);
      }),
      { seed: SEED, numRuns: 6 },
    );
  },
  CHECK_CASE_BOUND,
);
