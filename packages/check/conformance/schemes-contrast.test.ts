// Spec: k.schemes, clause "With color tokens `fg` `{ light: '#111111', dark: '#787878' }` and `bg` `'#ffffff'`, `<Text fg=\"fg\" bg=\"bg\">x</Text>` is one E1804 with message `fg \"fg\" on bg \"bg\" is 4.42:1 in dark, needs 4.5:1`; with `schemes: ['light']` it is none."
// Spec: k.schemes, clause "With `tokens.ts` exporting `brandTokens`, a page rendering a `SchemeSelect` is one E1814 at the element with message `SchemeSelect needs schemes light and dark; the tokens have light only`."
// Rules (k.schemes): "E1814 `SchemeSelect` with one scheme (message `SchemeSelect needs schemes light and dark; the tokens have <scheme> only`; fix: none)"
// Seed: 1337 (fc.assert below).
// ASSUMPTIONS (k.looks In an app: E1814 judges the evaluated tokens, `tokens.ts` text only for positions): tokens reach `check()` as `artifacts: { tokens }` (as a11y-contrast-inherited.test.ts passes them); for E1814 the project also holds `tokens.ts` as source text, the file the clause names, and the artifact is what that file evaluates to. "At the element" is a position on the `<SchemeSelect` line from its `<` to the end of its name.
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { BRAND_ONLY, atText } from "./library-looks-support.ts";
import { SEED, one } from "./support.ts";

const darkLow = () => defineTokens({ color: { fg: { light: "#111111", dark: "#787878" }, bg: "#ffffff" } });
const lightOnly = () =>
  defineTokens({ color: { fg: { light: "#111111", dark: "#787878" }, bg: "#ffffff" }, schemes: ["light"] });
const text = (): ReturnType<typeof one> =>
  one(`import { Text } from '@keel/ui'\nexport default function C() { return <Text fg="fg" bg="bg">x</Text> }\n`);
const e1804 = (tokens: unknown) =>
  check(text(), { artifacts: { tokens }, types: false }).diagnostics.filter((d) => d.code === "E1804");

describe("k.schemes: contrast is judged in each declared scheme", () => {
  test(
    "With color tokens `fg` `{ light: '#111111', dark: '#787878' }` and `bg` `'#ffffff'`, `<Text fg=\"fg\" bg=\"bg\">x</Text>` is one E1804 with message `fg \"fg\" on bg \"bg\" is 4.42:1 in dark, needs 4.5:1`; with `schemes: ['light']` it is none",
    () => {
      const d = e1804(darkLow());
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "fg" on bg "bg" is 4.42:1 in dark, needs 4.5:1');
      expect(e1804(lightOnly())).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with `schemes: ['dark']` the same dark pair is judged, and its light value is not",
    () => {
      const darkOnly = defineTokens({
        color: { fg: { light: "#cccccc", dark: "#787878" }, bg: "#ffffff" },
        schemes: ["dark"],
      });
      expect(e1804(darkOnly).map((d) => d.message)).toEqual(['fg "fg" on bg "bg" is 4.42:1 in dark, needs 4.5:1']);
      const lightLow = defineTokens({
        color: { fg: { light: "#787878", dark: "#111111" }, bg: "#ffffff" },
        schemes: ["dark"],
      });
      expect(e1804(lightLow)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a low pair in one scheme is judged exactly when that scheme is declared, whatever the declaration",
    () => {
      const decl = fc.constantFrom(["light"], ["dark"], ["light", "dark"], undefined);
      fc.assert(
        fc.property(decl, fc.constantFrom("light", "dark"), (schemes, low) => {
          const lowValue = "#787878";
          const fg = low === "dark" ? { light: "#111111", dark: lowValue } : { light: lowValue, dark: "#111111" };
          const tokens = defineTokens({ color: { fg, bg: "#ffffff" }, ...(schemes === undefined ? {} : { schemes }) });
          const declared = schemes ?? ["light", "dark"];
          expect(e1804(tokens).length).toBe(declared.includes(low) ? 1 : 0);
        }),
        { seed: SEED, numRuns: 24 },
      );
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.schemes: E1814 SchemeSelect with one scheme", () => {
  const SELECT =
    "<SchemeSelect id=\"scheme\" label=\"Scheme\" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} />";
  const page = (): ReturnType<typeof one> =>
    one(`import { SchemeSelect } from '@keel/ui'\nexport default function C() { return ${SELECT} }\n`);
  const run = (tokensSource: string, tokens: unknown) =>
    check([...page(), { path: "tokens.ts", source: tokensSource }], {
      artifacts: { tokens },
      types: false,
    }).diagnostics.filter((d) => d.code === "E1814");

  test(
    "With `tokens.ts` exporting `brandTokens`, a page rendering a `SchemeSelect` is one E1814 at the element with message `SchemeSelect needs schemes light and dark; the tokens have light only`",
    () => {
      const d = run(BRAND_ONLY, brandTokens);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe("SchemeSelect needs schemes light and dark; the tokens have light only");
      expect(d[0]?.path).toBe("C.tsx");
      expect(atText(page()[0]?.source ?? "", "<SchemeSelect", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the message names the one scheme the tokens have: `dark only` for `schemes: ['dark']`",
    () => {
      const dark = defineTokens({ ...brandTokens, schemes: ["dark"] });
      expect(run("export const tokens = dark\n", dark).map((d) => d.message)).toEqual([
        "SchemeSelect needs schemes light and dark; the tokens have dark only",
      ]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "tokens with both schemes, declared or implied by an own color pair, give no E1814",
    () => {
      const declared = defineTokens({ ...brandTokens, schemes: ["light", "dark"] });
      const implied = defineTokens({
        ...brandTokens,
        color: { ...brandTokens.color, mine: { light: "#111111", dark: "#eeeeee" } },
      });
      const libraryPair = defineTokens({
        ...brandTokens,
        color: { ...brandTokens.color, "acme.x": { light: "#111111", dark: "#eeeeee" } },
      });
      expect(run("export const tokens = declared\n", declared)).toEqual([]);
      expect(run("export const tokens = implied\n", implied)).toEqual([]);
      expect(run("export const tokens = libraryPair\n", libraryPair).length).toBe(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a page that renders no `SchemeSelect` has no E1814, whatever the tokens",
    () => {
      const d = check(one(`import { Text } from '@keel/ui'\nexport default function C() { return <Text>x</Text> }\n`), {
        artifacts: { tokens: brandTokens },
        types: false,
      }).diagnostics.filter((x) => x.code === "E1814");
      expect(d).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});
