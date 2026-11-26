// Spec: k.values, clause "A shipped `acmeTokens` holding `font: { 'acme.f': '\"Inter' }` is one E1812 with message `acmeTokens fails TokenSchema at font.acme.f`."
// Spec: k.values, clause "A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `light` or `dark` after it for a pair): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks)."
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
