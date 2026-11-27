// Spec: k.themes, clause "`themes: { slate: { color: { text: '#222222' } } }` is accepted with a color token `text`; each of `themes: { light: {} }`, `themes: { a: { when: 'hover' } }`, `themes: { a: { color: { nope: '#000000' } } }`, `themes: { a: { breakpoint: { md: '1px' } } }`, `themes: { a: { look: {} } }`, `themes: { a: { when: 'print', color: { text: { light: '#000000', dark: '#ffffff' } } } }`, two themes with `when: 'print'` and nine themes with no `when` fails `TokenSchema`, each one E1807 in `tokens.ts`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS: "fails `TokenSchema`, each one E1807 in `tokens.ts`" is read as `defineTokens` throwing code E1807 (as schemes-css.test.ts reads it for `schemes`) and `TokenSchema.parse` returning an error. A valid tokens object is written through `withGroups` (base-support.ts), which passes plain data so `themes` type-checks before `Tokens` names it. Group names a theme may hold are the ten k.values Themes lists; the spec's name rule "a letter from `a` to `z` then up to 23 letters and digits" is read as lowercase letters first and letters of either case and digits after.
import { TokenSchema } from "@keel/ui/tokens";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeOf, withGroups } from "./base-support.ts";
import { SEED } from "./fixtures.ts";

const COLOR = { text: "#111111", surface: { light: "#ffffff", dark: "#111111" } };
const base = (themes: unknown, more: Record<string, unknown> = {}): Record<string, unknown> => ({
  color: COLOR,
  ...more,
  themes,
});
const valid = (tokens: Record<string, unknown>): boolean =>
  TokenSchema.parse({ ...tokens }).ok && codeOf(() => withGroups(tokens)) === null;
const refused = (tokens: Record<string, unknown>): boolean =>
  !TokenSchema.parse({ ...tokens }).ok && codeOf(() => withGroups(tokens)) === "E1807";
const choice = (count: number): Record<string, unknown> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`t${String.fromCharCode(97 + i)}`, { color: { text: "#222222" } }]),
  );

describe("k.values: themes", () => {
  test("`themes: { slate: { color: { text: '#222222' } } }` is accepted with a color token `text`", () => {
    expect(valid(base({ slate: { color: { text: "#222222" } } }))).toBe(true);
  });

  test("`themes: { light: {} }` fails `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ light: {} }))).toBe(true);
  });

  test("`themes: { a: { when: 'hover' } }` fails `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ a: { when: "hover" } }))).toBe(true);
  });

  test("`themes: { a: { color: { nope: '#000000' } } }` fails `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ a: { color: { nope: "#000000" } } }))).toBe(true);
  });

  test("`themes: { a: { breakpoint: { md: '1px' } } }` fails `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ a: { breakpoint: { md: "1px" } } }))).toBe(true);
  });

  test("`themes: { a: { look: {} } }` fails `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ a: { look: {} } }))).toBe(true);
  });

  test("`themes: { a: { when: 'print', color: { text: { light: '#000000', dark: '#ffffff' } } } }` fails `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ a: { when: "print", color: { text: { light: "#000000", dark: "#ffffff" } } } }))).toBe(true);
    expect(valid(base({ a: { when: "print", color: { text: "#000000" } } }))).toBe(true);
  });

  test("two themes with `when: 'print'` fail `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base({ a: { when: "print" }, b: { when: "print" } }))).toBe(true);
    expect(valid(base({ a: { when: "print" }, b: { when: "contrast" } }))).toBe(true);
  });

  test("nine themes with no `when` fail `TokenSchema`, one E1807 in `tokens.ts`", () => {
    expect(refused(base(choice(9)))).toBe(true);
    expect(valid(base(choice(8)))).toBe(true);
  });

  test("at most 8 are `choice`, one `contrast` and one `print`, whatever the counts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        (c, hc, pr, explicit) => {
          const themes: Record<string, unknown> = {};
          for (let i = 0; i < c; i++) themes[`c${String.fromCharCode(97 + i)}`] = explicit ? { when: "choice" } : {};
          for (let i = 0; i < hc; i++) themes[`h${String.fromCharCode(97 + i)}`] = { when: "contrast" };
          for (let i = 0; i < pr; i++) themes[`p${String.fromCharCode(97 + i)}`] = { when: "print" };
          const within = c <= 8 && hc <= 1 && pr <= 1;
          expect(TokenSchema.parse(base(themes)).ok).toBe(within);
          expect(codeOf(() => withGroups(base(themes)))).toBe(within ? null : "E1807");
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("a name is a letter from `a` to `z` then up to 23 letters and digits, not `default`, `system`, `light` or `dark`", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.stringMatching(/^[a-z][A-Za-z0-9]{0,23}$/),
          fc.stringMatching(/^[a-z][A-Za-z0-9]{24,28}$/),
          fc.stringMatching(/^[0-9A-Z-][A-Za-z0-9]{0,5}$/),
          fc.stringMatching(/^[a-z][a-z0-9.\- _]{1,6}$/),
          fc.constantFrom("default", "system", "light", "dark", ""),
        ),
        (name) => {
          const ok = /^[a-z][A-Za-z0-9]{0,23}$/.test(name) && !["default", "system", "light", "dark"].includes(name);
          expect(TokenSchema.parse(base({ [name]: {} })).ok, JSON.stringify(name)).toBe(ok);
        },
      ),
      { seed: SEED, numRuns: 120 },
    );
  });

  test("a theme holds `color`, `overlay`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow` and `border`, each re-valuing a name the top level holds, and no other group", () => {
    const top = {
      color: COLOR,
      overlay: { scrim: { value: "#00000099", over: ["text"] } },
      space: { 1: "4px" },
      size: { full: "100%" },
      radius: { 1: "4px" },
      font: { body: "system-ui" },
      fontSize: { md: "16px" },
      weight: { bold: "700" },
      shadow: { s: "0 1px 2px #000000" },
      border: { b: "1px solid #000000" },
    };
    const theme = {
      color: { text: "#222222" },
      overlay: { scrim: "#00000066" },
      space: { 1: "8px" },
      size: { full: "50%" },
      radius: { 1: "8px" },
      font: { body: "Georgia, serif" },
      fontSize: { md: "18px" },
      weight: { bold: "800" },
      shadow: { s: "0 2px 4px rgb(0 0 0 / 0.3)" },
      border: { b: "2px solid #111111" },
    };
    expect(valid({ ...top, themes: { t: theme } })).toBe(true);
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(theme)), (group) => {
        const alone = { [group]: Reflect.get(theme, group) };
        expect(valid({ ...top, themes: { t: alone } }), group).toBe(true);
        const unknown = { [group]: { ...Object.fromEntries([[`${group}Nope`, "x"]]) } };
        expect(TokenSchema.parse({ ...top, themes: { t: unknown } }).ok, group).toBe(false);
      }),
      { seed: SEED, numRuns: 20 },
    );
    expect(refused({ ...top, themes: { t: { motion: { fast: "1s" } } } })).toBe(true);
    expect(refused({ ...top, themes: { t: { base: {} } } })).toBe(true);
  });

  test("an overlay in a theme is its `value` with no `over`", () => {
    const top = { color: COLOR, overlay: { scrim: { value: "#00000099", over: ["text"] } } };
    expect(valid({ ...top, themes: { hc: { when: "contrast", overlay: { scrim: "#000000cc" } } } })).toBe(true);
    expect(
      refused({
        ...top,
        themes: { hc: { when: "contrast", overlay: { scrim: { value: "#000000cc", over: ["text"] } } } },
      }),
    ).toBe(true);
    expect(refused({ ...top, themes: { hc: { when: "contrast", overlay: { scrim: "#000000" } } } })).toBe(true);
  });

  test("a theme's value is held to its group's form, refused with rule `format` at `themes.<theme>.<group>.<name>`", () => {
    const r = TokenSchema.parse({ ...base({ a: { color: { text: "white" } } }) });
    expect(r.ok).toBe(false);
    const issues = r.ok ? [] : r.error.data.issues;
    expect(issues.some((i) => i.rule === "format" && i.path.join(".") === "themes.a.color.text")).toBe(true);
  });
});
