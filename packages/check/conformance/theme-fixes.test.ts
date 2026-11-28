// Spec: k.themes, clause "With a theme `slate`, applying both E1816 fixes to `<ThemeSelect id=\"t\" label=\"Theme\" labels={{ default: 'Keel', forest: 'Forest' }} />` leaves `labels` evaluating to `{ default: 'Keel', slate: 'slate' }` and no E1816; with `brandTokens`, the fix for a file whose one use is `<ThemeSelect id=\"t\" label=\"Theme\" />`, imported by `import { Box, ThemeSelect } from '@keel/ui'`, deletes the element and leaves `import { Box } from '@keel/ui'`."
// Spec: k.themes, clause "With k.a11y-static's overlay tokens (`over: ['surface', 'card']`), the E1817 fix for `<Box bg=\"text\"><Text fg=\"on\" bg=\"scrim\">x</Text></Box>` makes that `over` `['surface', 'card', \"text\"]`, after which `keel check` reports no E1817; with an `over` of 8 names, that E1817 has no fix."
// Spec: k.themes, clause "With a theme `slate`, `<ThemeSelect id=\"t\" label=\"Theme\" labels={{ ...words, forest: 'Forest' }} />` is one E1816, `ThemeSelect labels name no theme forest`, after whose fix `keel check` reports none; with `labels={{ ...words }}` it is none."
// Spec: k.themes, clause "With k.a11y-static's overlay tokens written `over: ['surface', 'card'] as const`, the E1817 fix for `<Box bg=\"text\"><Text fg=\"on\" bg=\"scrim\">x</Text></Box>` makes that `over` `['surface', 'card', \"text\"] as const`, after which `keel check` reports no E1817."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// ASSUMPTIONS: as theme-select-e1816.test.ts and library-looks-support.ts: tokens reach `check()` as `artifacts: { tokens }` beside the `tokens.ts` text, a fix is a diff applied with `applyFix`. "Applying both E1816 fixes" is read as applying one fix, checking again and applying the next, as the two edits of one `labels` object overlap in a diff made against the original text. `labels` is evaluated by reading its `key: 'value'` pairs.
// Untestable in this folder: "after which `keel check` reports no E1817" through the binary; it is asserted with `check()` over the fixed `tokens.ts` text's tokens.
import { check } from "@keel/check";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { type Files, BRAND_ONLY, applyFix, sourceOf } from "./library-looks-support.ts";
import { SEED, looseTokens } from "./support.ts";

const diags = (files: Files, tokens: unknown, code: string) =>
  check(files, { artifacts: { tokens }, types: false }).diagnostics.filter((d) => d.code === code);

const SELECT = `<ThemeSelect id="t" label="Theme" labels={{ default: 'Keel', forest: 'Forest' }} />`;
const labelsOf = (source: string): Record<string, string> => {
  const body = /labels=\{\{([^}]*)\}\}/.exec(source)?.[1] ?? "";
  return Object.fromEntries(
    [...body.matchAll(/([A-Za-z_]\w*)\s*:\s*(['"])(.*?)\2/g)].map((m) => [m[1] ?? "", m[3] ?? ""]),
  );
};
/** Apply the first fix of `code`, check again, and repeat until none is left (at most `max` rounds). */
const fixAll = (files: Files, tokens: unknown, code: string, max = 4): Files => {
  let now = files;
  for (let i = 0; i < max; i++) {
    const fix = diags(now, tokens, code).find((d) => d.fix !== undefined)?.fix;
    if (fix === undefined) break;
    now = applyFix(now, fix);
  }
  return now;
};

describe("k.themes: the fixes of E1816", () => {
  const slate = looseTokens({ ...brandTokens, themes: { slate: { color: { surface: "#F4F7FB" } } } });
  const page = (jsx: string, head = "import { ThemeSelect } from '@keel/ui'\n"): Files => [
    { path: "C.tsx", source: `${head}export default function C() { return ${jsx} }\n` },
    { path: "tokens.ts", source: BRAND_ONLY },
  ];

  test(
    "With a theme `slate`, applying both E1816 fixes to `<ThemeSelect id=\"t\" label=\"Theme\" labels={{ default: 'Keel', forest: 'Forest' }} />` leaves `labels` evaluating to `{ default: 'Keel', slate: 'slate' }` and no E1816",
    () => {
      const files = page(SELECT);
      expect(diags(files, slate, "E1816").map((d) => d.message)).toEqual([
        "ThemeSelect labels lack slate",
        "ThemeSelect labels name no theme forest",
      ]);
      const fixed = fixAll(files, slate, "E1816");
      expect(labelsOf(sourceOf(fixed, "C.tsx"))).toEqual({ default: "Keel", slate: "slate" });
      expect(diags(fixed, slate, "E1816")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    'for `labels lack <name>` the fix adds `<name>: "<name>"` after its last property, whichever themes `labels` lacks',
    () => {
      const names = ["slate", "ocean", "dusk"];
      fc.assert(
        fc.property(fc.subarray(names, { minLength: 1 }), (themes) => {
          const tokens = looseTokens({
            ...brandTokens,
            themes: Object.fromEntries(themes.map((t) => [t, { color: {} }])),
          });
          const files = page(`<ThemeSelect id="t" label="Theme" labels={{ default: 'Keel' }} />`);
          const fixed = fixAll(files, tokens, "E1816", 6);
          expect(labelsOf(sourceOf(fixed, "C.tsx"))).toEqual({
            default: "Keel",
            ...Object.fromEntries(themes.map((t) => [t, t])),
          });
          expect(diags(fixed, tokens, "E1816")).toEqual([]);
        }),
        { seed: SEED, numRuns: 6 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "for `labels name no theme <key>` the fix deletes that property and its comma",
    () => {
      const files = page(
        `<ThemeSelect id="t" label="Theme" labels={{ default: 'Keel', slate: 'Slate', forest: 'Forest' }} />`,
      );
      const fixed = fixAll(files, slate, "E1816");
      expect(labelsOf(sourceOf(fixed, "C.tsx"))).toEqual({ default: "Keel", slate: "Slate" });
      expect(sourceOf(fixed, "C.tsx")).not.toContain("forest");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with `brandTokens`, the fix for a file whose one use is `<ThemeSelect id=\"t\" label=\"Theme\" />`, imported by `import { Box, ThemeSelect } from '@keel/ui'`, deletes the element and leaves `import { Box } from '@keel/ui'`",
    () => {
      const files = page(
        `<Box><ThemeSelect id="t" label="Theme" /></Box>`,
        "import { Box, ThemeSelect } from '@keel/ui'\n",
      );
      const d = diags(files, brandTokens, "E1816");
      expect(d.map((x) => x.message)).toEqual(["ThemeSelect needs a choice theme; the tokens have none"]);
      const fixed = fixAll(files, brandTokens, "E1816");
      const text = sourceOf(fixed, "C.tsx");
      expect(text).not.toContain("<ThemeSelect");
      expect(text).toContain("import { Box } from '@keel/ui'");
      expect(text).not.toContain("ThemeSelect");
      expect(diags(fixed, brandTokens, "E1816")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "when that was the file's one use of its `ThemeSelect` import and the import held no other specifier, the fix deletes the whole import declaration",
    () => {
      const files = page(`<><ThemeSelect id="t" label="Theme" /></>`);
      const text = sourceOf(fixAll(files, brandTokens, "E1816"), "C.tsx");
      expect(text).not.toContain("ThemeSelect");
      expect(text).not.toContain("from '@keel/ui'");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "when the file has another use of `ThemeSelect`, the fix deletes the element and keeps the import specifier",
    () => {
      const files = page(
        `<><ThemeSelect id="t" label="Theme" /><ThemeSelect id="u" label="Other" /></>`,
        "import { Box, ThemeSelect } from '@keel/ui'\n",
      );
      const fix = diags(files, brandTokens, "E1816").find((d) => d.fix !== undefined)?.fix;
      expect(fix).toBeDefined();
      const text = sourceOf(applyFix(files, fix ?? ""), "C.tsx");
      expect(text.match(/<ThemeSelect/g)?.length).toBe(1);
      expect(text).toContain("ThemeSelect } from '@keel/ui'");
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.themes: the fix of E1817", () => {
  const COLORS = { card: "#FFFFFF", surface: "#F9F9F9", on: "#FFFFFF", text: "#1a191e" };
  const VIEW = `<Box bg="text"><Text fg="on" bg="scrim">x</Text></Box>`;
  const tokensSource = (over: string): string =>
    `import { defineTokens } from '@keel/ui/tokens'\nexport const tokens = defineTokens({\n  color: { card: '#FFFFFF', surface: '#F9F9F9', on: '#FFFFFF', text: '#1a191e' },\n  overlay: { scrim: { value: 'rgb(26 25 30 / 0.6)', over: ${over} } },\n})\n`;
  const files = (over: string): Files => [
    {
      path: "C.tsx",
      source: `import { Box, Text } from '@keel/ui'\nexport default function C() { return ${VIEW} }\n`,
    },
    { path: "tokens.ts", source: tokensSource(over) },
  ];
  const tokensFor = (names: string[], extra: Record<string, string> = {}) =>
    looseTokens({
      color: { ...COLORS, ...extra },
      overlay: { scrim: { value: "rgb(26 25 30 / 0.6)", over: names } },
    });
  const overOf = (source: string): string[] => {
    const body = /over:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? "";
    return [...body.matchAll(/(['"])(.*?)\1/g)].map((m) => m[2] ?? "");
  };

  test(
    "With k.a11y-static's overlay tokens (`over: ['surface', 'card']`), the E1817 fix for `<Box bg=\"text\"><Text fg=\"on\" bg=\"scrim\">x</Text></Box>` makes that `over` `['surface', 'card', \"text\"]`",
    () => {
      const f = files("['surface', 'card']");
      const d = diags(f, tokensFor(["surface", "card"]), "E1817");
      expect(d).toHaveLength(1);
      expect(d[0]?.fix).toBeDefined();
      const fixed = applyFix(f, d[0]?.fix ?? "");
      expect(overOf(sourceOf(fixed, "tokens.ts"))).toEqual(["surface", "card", "text"]);
      expect(sourceOf(fixed, "tokens.ts")).toContain(`"text"`);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "after which `keel check` reports no E1817",
    () => {
      const f = files("['surface', 'card']");
      const d = diags(f, tokensFor(["surface", "card"]), "E1817");
      const fixed = applyFix(f, d[0]?.fix ?? "");
      expect(diags(fixed, tokensFor(overOf(sourceOf(fixed, "tokens.ts"))), "E1817")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with an `over` of 8 names, that E1817 has no fix",
    () => {
      const extra = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`c${i}`, "#FFFFFF"]));
      const names = ["surface", "card", ...Object.keys(extra)];
      expect(names).toHaveLength(8);
      const f = files(`[${names.map((n) => `'${n}'`).join(", ")}]`);
      const d = diags(f, tokensFor(names, extra), "E1817");
      expect(d).toHaveLength(1);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the length of `over` under 8, the fix adds the backdrop after the last element and leaves the others",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 7 }), (n) => {
          const extra = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`c${i}`, "#FFFFFF"]));
          const names = ["surface", "card", ...Object.keys(extra)].slice(0, n);
          const f = files(`[${names.map((x) => `'${x}'`).join(", ")}]`);
          const d = diags(f, tokensFor(names, extra), "E1817");
          expect(d).toHaveLength(1);
          const fixed = applyFix(f, d[0]?.fix ?? "");
          expect(overOf(sourceOf(fixed, "tokens.ts"))).toEqual([...names, "text"]);
        }),
        { seed: SEED, numRuns: 7 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an overlay on an overlay has no fix: `over` names only colors",
    () => {
      const t = looseTokens({
        color: { card: "#FFFFFF", on: "#FFFFFF" },
        overlay: {
          scrim: { value: "rgb(26 25 30 / 0.6)", over: ["card"] },
          veil: { value: "rgb(26 25 30 / 0.2)", over: ["card"] },
        },
      });
      const f: Files = [
        {
          path: "C.tsx",
          source: `import { Box, Text } from '@keel/ui'\nexport default function C() { return <Box bg="veil"><Text fg="on" bg="scrim">x</Text></Box> }\n`,
        },
        { path: "tokens.ts", source: tokensSource("['card']") },
      ];
      const d = diags(f, t, "E1817");
      expect(d).toHaveLength(1);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.themes: E1816 judges a `labels` literal holding a spread by its literal keys only", () => {
  const slate = looseTokens({ ...brandTokens, themes: { slate: { color: { surface: "#F4F7FB" } } } });
  const HEAD = "import { ThemeSelect } from '@keel/ui'\nconst words = { default: 'Keel', slate: 'Slate' }\n";
  const page = (labels: string): Files => [
    {
      path: "C.tsx",
      source: `${HEAD}export default function C() { return <ThemeSelect id="t" label="Theme" labels={${labels}} /> }\n`,
    },
    { path: "tokens.ts", source: BRAND_ONLY },
  ];
  const squash = (source: string): string => source.replace(/\s+/g, "");

  test(
    'With a theme `slate`, `<ThemeSelect id="t" label="Theme" labels={{ ...words, forest: \'Forest\' }} />` is one E1816, `ThemeSelect labels name no theme forest`',
    () => {
      const d = diags(page("{ ...words, forest: 'Forest' }"), slate, "E1816");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe("ThemeSelect labels name no theme forest");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "after whose fix `keel check` reports none: the fix deletes `forest: 'Forest'` and its comma and keeps the spread",
    () => {
      const files = page("{ ...words, forest: 'Forest' }");
      const fix = diags(files, slate, "E1816")[0]?.fix;
      expect(fix).toBeDefined();
      const fixed = applyFix(files, fix ?? "");
      expect(squash(sourceOf(fixed, "C.tsx"))).toContain("labels={{...words}}");
      expect(diags(fixed, slate, "E1816")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with `labels={{ ...words }}` it is none",
    () => {
      expect(diags(page("{ ...words }"), slate, "E1816")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the literal keys beside the spread, a key naming a theme is none and a key naming none is one E1816 each, and a lacking name is never reported",
    () => {
      const keys = ["default", "slate", "forest", "ocean"];
      fc.assert(
        fc.property(fc.subarray(keys), (written) => {
          const body = ["...words", ...written.map((k) => `${k}: 'x'`)].join(", ");
          const d = diags(page(`{ ${body} }`), slate, "E1816").map((x) => x.message);
          const unknown = written.filter((k) => !["default", "slate"].includes(k));
          expect(d.sort()).toEqual(unknown.map((k) => `ThemeSelect labels name no theme ${k}`).sort());
        }),
        { seed: SEED, numRuns: 8 },
      );
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.themes: the fix of E1817 on an `over` written `as const`", () => {
  const VIEW = `<Box bg="text"><Text fg="on" bg="scrim">x</Text></Box>`;
  const tokensSource = (over: string): string =>
    `import { defineTokens } from '@keel/ui/tokens'\nexport const tokens = defineTokens({\n  color: { card: '#FFFFFF', surface: '#F9F9F9', on: '#FFFFFF', text: '#1a191e' },\n  overlay: { scrim: { value: 'rgb(26 25 30 / 0.6)', over: ${over} } },\n})\n`;
  const files = (over: string): Files => [
    {
      path: "C.tsx",
      source: `import { Box, Text } from '@keel/ui'\nexport default function C() { return ${VIEW} }\n`,
    },
    { path: "tokens.ts", source: tokensSource(over) },
  ];
  const tokensFor = (names: string[]) =>
    looseTokens({
      color: { card: "#FFFFFF", surface: "#F9F9F9", on: "#FFFFFF", text: "#1a191e" },
      overlay: { scrim: { value: "rgb(26 25 30 / 0.6)", over: names } },
    });

  test(
    "With k.a11y-static's overlay tokens written `over: ['surface', 'card'] as const`, the E1817 fix for `<Box bg=\"text\"><Text fg=\"on\" bg=\"scrim\">x</Text></Box>` makes that `over` `['surface', 'card', \"text\"] as const`",
    () => {
      const f = files("['surface', 'card'] as const");
      const d = diags(f, tokensFor(["surface", "card"]), "E1817");
      expect(d).toHaveLength(1);
      expect(d[0]?.fix).toBeDefined();
      const fixed = applyFix(f, d[0]?.fix ?? "");
      expect(sourceOf(fixed, "tokens.ts")).toContain(`over: ['surface', 'card', "text"] as const`);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "after which `keel check` reports no E1817",
    () => {
      const f = files("['surface', 'card'] as const");
      const fixed = applyFix(f, diags(f, tokensFor(["surface", "card"]), "E1817")[0]?.fix ?? "");
      expect(diags(fixed, tokensFor(["surface", "card", "text"]), "E1817")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the length of `over` under 8, written bare or with `as const`, the fix adds the backdrop after the last element and keeps the `as const`",
    () => {
      const extra = Array.from({ length: 6 }, (_, i) => `c${i}`);
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 7 }), fc.boolean(), (n, asConst) => {
          const names = ["surface", "card", ...extra].slice(0, n);
          const tail = asConst ? " as const" : "";
          const f = files(`[${names.map((x) => `'${x}'`).join(", ")}]${tail}`);
          const tokens = looseTokens({
            color: {
              card: "#FFFFFF",
              surface: "#F9F9F9",
              on: "#FFFFFF",
              text: "#1a191e",
              ...Object.fromEntries(extra.map((x) => [x, "#FFFFFF"])),
            },
            overlay: { scrim: { value: "rgb(26 25 30 / 0.6)", over: names } },
          });
          const d = diags(f, tokens, "E1817");
          expect(d).toHaveLength(1);
          const fixed = applyFix(f, d[0]?.fix ?? "");
          expect(sourceOf(fixed, "tokens.ts")).toContain(
            `over: [${[...names.map((x) => `'${x}'`), '"text"'].join(", ")}]${tail}`,
          );
        }),
        { seed: SEED, numRuns: 10 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
