// Spec: k.schemes, clause "With `brandTokens`, a `ThemeSelect` is one E1816 with message `ThemeSelect needs a choice theme; the tokens have none`; with a theme `slate` and `labels={{ default: 'Keel', forest: 'Forest' }}` it is two, `ThemeSelect labels lack slate` and `ThemeSelect labels name no theme forest`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS (as schemes-contrast.test.ts for E1814): tokens reach `check()` as `artifacts: { tokens }` and the project also holds `tokens.ts` as source text; "at the element" is a position on the `<ThemeSelect` line; the two messages of the second case come in the order the clause lists them (`lack` first, then `name no theme`), the order a theme missing from `labels` and a key naming no theme are met in the clause.
// AMBIGUOUS (k.schemes Checks): where a `labels` finding sits (the element, or the key) is not said; the cases assert the path and the element's line only. Only `choice` themes count: `ThemeSelect needs a choice theme` holds for an app whose only themes are `contrast` and `print`.
import { check } from "@keel/check";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { BRAND_ONLY, atText } from "./library-looks-support.ts";
import { SEED, looseTokens, one } from "./support.ts";

const select = (labels: string): string => `<ThemeSelect id="theme" label="Theme" labels={{ ${labels} }} />`;
const page = (labels = "default: 'Keel'"): ReturnType<typeof one> =>
  one(`import { ThemeSelect } from '@keel/ui'\nexport default function C() { return ${select(labels)} }\n`);
const withThemes = (themes: unknown) => looseTokens({ ...brandTokens, themes });
const run = (files: ReturnType<typeof one>, tokens: unknown) =>
  check([...files, { path: "tokens.ts", source: BRAND_ONLY }], {
    artifacts: { tokens },
    types: false,
  }).diagnostics.filter((d) => d.code === "E1816");
const SLATE = { slate: { color: { surface: "#F4F7FB" } } };

describe("k.schemes: E1816 ThemeSelect without a theme or with other labels", () => {
  test(
    "With `brandTokens`, a `ThemeSelect` is one E1816 with message `ThemeSelect needs a choice theme; the tokens have none`",
    () => {
      const d = run(page(), brandTokens);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe("ThemeSelect needs a choice theme; the tokens have none");
      expect(d[0]?.path).toBe("C.tsx");
      expect(atText(page()[0]?.source ?? "", "<ThemeSelect", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with a theme `slate` and `labels={{ default: 'Keel', forest: 'Forest' }}` it is two, `ThemeSelect labels lack slate` and `ThemeSelect labels name no theme forest`",
    () => {
      const d = run(page("default: 'Keel', forest: 'Forest'"), withThemes(SLATE));
      expect(d.map((x) => x.message)).toEqual([
        "ThemeSelect labels lack slate",
        "ThemeSelect labels name no theme forest",
      ]);
      for (const x of d) {
        expect(x.path).toBe("C.tsx");
        expect(x.line).toBe(2);
        expect(x.fix).toBeUndefined();
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "labels that are `default` and exactly the `choice` themes give no E1816",
    () => {
      const themes = { ...SLATE, forest: { color: { surface: "#EEF5EE" } }, hc: { when: "contrast", color: {} } };
      expect(run(page("default: 'Keel', slate: 'Slate', forest: 'Forest'"), withThemes(themes))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`contrast` and `print` themes are no `choice` theme: with only those, `ThemeSelect needs a choice theme; the tokens have none`, and a label naming one is `ThemeSelect labels name no theme <key>`",
    () => {
      const only = { hc: { when: "contrast", color: {} }, paper: { when: "print", color: {} } };
      expect(run(page(), withThemes(only)).map((d) => d.message)).toEqual([
        "ThemeSelect needs a choice theme; the tokens have none",
      ]);
      expect(
        run(page("default: 'Keel', slate: 'S', hc: 'High'"), withThemes({ ...SLATE, ...only })).map((d) => d.message),
      ).toEqual(["ThemeSelect labels name no theme hc"]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the `choice` themes and the label keys, each theme missing from `labels` is one `lack` and each other key one `name no theme`",
    () => {
      const names = ["slate", "forest", "ocean", "dusk"];
      fc.assert(
        fc.property(fc.subarray(names, { minLength: 1 }), fc.subarray([...names, "nope", "other"]), (themes, keys) => {
          const tokens = withThemes(Object.fromEntries(themes.map((t) => [t, { color: {} }])));
          const labels = ["default", ...keys].map((k) => `${k}: '${k}'`).join(", ");
          const got = run(page(labels), tokens).map((d) => d.message);
          const want = [
            ...themes.filter((t) => !keys.includes(t)).map((t) => `ThemeSelect labels lack ${t}`),
            ...keys.filter((k) => !themes.includes(k)).map((k) => `ThemeSelect labels name no theme ${k}`),
          ];
          expect([...got].sort()).toEqual([...want].sort());
        }),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a `ThemeSelect` found through a namespace import, or a re-export from an app file, is one E1816 as a direct one is",
    () => {
      const ns = one(
        `import * as ui from '@keel/ui'\nexport default function C() { return <ui.ThemeSelect id="theme" label="Theme" labels={{ default: 'Keel' }} /> }\n`,
      );
      expect(run(ns, brandTokens)).toHaveLength(1);
      const re = [
        { path: "Sel.ts", source: "export { ThemeSelect as Pick } from '@keel/ui'\n" },
        {
          path: "C.tsx",
          source: `import { Pick } from './Sel.ts'\nexport default function C() { return <Pick id="theme" label="Theme" labels={{ default: 'Keel' }} /> }\n`,
        },
      ];
      expect(run(re, brandTokens)).toHaveLength(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a page that renders no `ThemeSelect` has no E1816, whatever the tokens",
    () => {
      const none = one(`import { Text } from '@keel/ui'\nexport default function C() { return <Text>x</Text> }\n`);
      expect(run(none, brandTokens)).toEqual([]);
      expect(run(none, withThemes(SLATE))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});
