// Spec: k.looks, clause "In the fixture with `tokens.ts` `import { brandTokens } from \"@keel/ui/brand\";` and `export const tokens = brandTokens;`, `keel check` reports one E1810 at `tokens` with message `@acme/ui needs color \"acme.accent\" and 2 more; import acmeTokens from @acme/ui/tokens` and no E1801."
// Spec: k.looks, clause "Applying that fix makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...acmeTokens.color }, look: { ...brandTokens.look, ...acmeTokens.look } })` with `defineTokens` and `acmeTokens` imported, and the next `keel check` reports no diagnostic."
// Spec: k.looks, clause "In the fixed project with `'acme.accent': '#b8420d'` after `...acmeTokens.color`, `keel check` reports no diagnostic and `keel build`'s CSS holds `--k-color-acme-accent:#b8420d` and no `#0B5CAD`."
// Spec: k.looks, clause "In the fixed project, a `color` key `'acme.acent': '#000000'` is one E1813 with message `color \"acme.acent\": @acme/ui ships no such token`, and a key `'zed.x': '#000000'` is one E1813 with message `color \"zed.x\": no library the app lists has id zed`."
// Spec: k.looks, clause "In the fixed project with the `look` spread removed, `keel check` reports one E1810 with message `@acme/ui needs look \"acme.badge\"; spread acmeTokens.look`."
// Spec: k.looks, clause "In the fixture with no `tokens.ts`, `keel check` reports one E1810 at the `'@acme/ui'` entry, with no fix."
// k.looks, Rules: "E1810 a listed library's needed name the app's tokens lack (Message; fix: Fix)" and "E1813 a name with a `.` in the app's tokens that no listed library ships, or a fixture key overriding a default (In an app, Own folder; fix: none)" (the app half; the fixture half is library-looks-own-folder.test.ts).
// Seed: 1337 (fc.assert below). The CSS half of the third clause (`keel build`) is asserted over `compileStyles` of the composed tokens; the build itself is an end-to-end case.
// ASSUMPTIONS: see library-looks-support.ts. E1813's "first occurrence of the quoted name" is read as the key as written (`'acme.acent'`); a column from its opening quote to the end of the name counts. The fix's text is compared in squashed form (whitespace, trailing commas, quote style and `;` removed), since the spec states the object and not the layout.
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import {
  BRAND_ONLY,
  type Files,
  NO_TYPES,
  SEED,
  acme,
  app,
  applyFix,
  atText,
  codesOf,
  fixedTokens,
  sourceOf,
  squash,
} from "./library-looks-support.ts";

const diagnostics = (files: Files) => check(files, NO_TYPES).diagnostics;

test(
  'In the fixture with `tokens.ts` `import { brandTokens } from "@keel/ui/brand";` and `export const tokens = brandTokens;`, `keel check` reports one E1810 at `tokens` with message `@acme/ui needs color "acme.accent" and 2 more; import acmeTokens from @acme/ui/tokens` and no E1801',
  () => {
    const files = app(BRAND_ONLY);
    const all = diagnostics(files);
    const d = all.filter((x) => x.code === "E1810");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui needs color "acme.accent" and 2 more; import acmeTokens from @acme/ui/tokens');
    expect(d[0]?.path).toBe("tokens.ts");
    expect(
      atText(
        sourceOf(files, "tokens.ts"),
        "tokens",
        d[0]?.line ?? 0,
        d[0]?.col ?? 0,
        BRAND_ONLY.indexOf("export const"),
      ),
    ).toBe(true);
    expect(all.filter((x) => x.code === "E1801")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "Applying that fix makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...acmeTokens.color }, look: { ...brandTokens.look, ...acmeTokens.look } })` with `defineTokens` and `acmeTokens` imported, and the next `keel check` reports no diagnostic",
  () => {
    const files = app(BRAND_ONLY);
    const fix = diagnostics(files).find((x) => x.code === "E1810")?.fix;
    expect(fix).toBeDefined();
    const patched = applyFix(files, fix ?? "");
    const text = squash(sourceOf(patched, "tokens.ts"));
    expect(text).toContain('import{defineTokens}from"@keel/ui"');
    expect(text).toContain('import{acmeTokens}from"@acme/ui/tokens"');
    expect(text).toContain(
      "exporttokens=defineTokens({...brandTokens,color:{...brandTokens.color,...acmeTokens.color},look:{...brandTokens.look,...acmeTokens.look}})",
    );
    expect(squash(sourceOf(patched, "tokens.ts"))).toBe(squash(fixedTokens()));
    expect(check(patched, NO_TYPES).diagnostics).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test("the fix names no file under `node_modules/` and edits `tokens.ts` alone", () => {
  const fix = diagnostics(app(BRAND_ONLY)).find((x) => x.code === "E1810")?.fix ?? "";
  const names = fix.split("\n").filter((l) => l.startsWith("--- ") || l.startsWith("+++ "));
  expect(names.length).toBeGreaterThan(0);
  for (const l of names) expect(l).toMatch(/tokens\.ts$/);
});

test(
  "In the fixed project with `'acme.accent': '#b8420d'` after `...acmeTokens.color`, `keel check` reports no diagnostic and `keel build`'s CSS holds `--k-color-acme-accent:#b8420d` and no `#0B5CAD`",
  () => {
    const files = app(fixedTokens(", 'acme.accent': '#b8420d'"));
    expect(diagnostics(files)).toEqual([]);
    // The build half: the composed object the file writes, compiled as `keel build` compiles tokens.
    const tokens = defineTokens({
      ...brandTokens,
      color: { ...brandTokens.color, "acme.accent": "#b8420d", "acme.ink": "#FFFFFF" },
      look: { ...brandTokens.look, "acme.badge": { bg: "acme.accent", fg: "acme.ink" } },
    });
    const css = compileStyles({ tokens, usages: [{ props: { look: "acme.badge" } }] }).css;
    expect(css.replace(/\s+/g, "")).toContain("--k-color-acme-accent:#b8420d");
    expect(css).not.toContain("#0B5CAD");
  },
  CHECK_CASE_BOUND,
);

test(
  "In the fixed project, a `color` key `'acme.acent': '#000000'` is one E1813 with message `color \"acme.acent\": @acme/ui ships no such token`",
  () => {
    const files = app(fixedTokens(", 'acme.acent': '#000000'"));
    const d = codesOf(files, "E1813");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('color "acme.acent": @acme/ui ships no such token');
    expect(d[0]?.path).toBe("tokens.ts");
    expect(atText(sourceOf(files, "tokens.ts"), "acme.acent", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "In the fixed project, a key `'zed.x': '#000000'` is one E1813 with message `color \"zed.x\": no library the app lists has id zed`",
  () => {
    const d = codesOf(app(fixedTokens(", 'zed.x': '#000000'")), "E1813");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('color "zed.x": no library the app lists has id zed');
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "a key with a `.` that no listed library ships is E1813, whatever its id and name; a key naming a token the library ships is not",
  () => {
    const word = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(word, word, (id, name) => {
        fc.pre(id !== "acme");
        const zed = codesOf(app(fixedTokens(`, '${id}.${name}': '#000000'`)), "E1813");
        expect(zed.map((d) => d.message)).toEqual([`color "${id}.${name}": no library the app lists has id ${id}`]);
        fc.pre(name !== "accent" && name !== "ink");
        const own = codesOf(app(fixedTokens(`, 'acme.${name}': '#000000'`)), "E1813");
        expect(own.map((d) => d.message)).toEqual([`color "acme.${name}": @acme/ui ships no such token`]);
      }),
      { seed: SEED, numRuns: 5 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  'In the fixed project with the `look` spread removed, `keel check` reports one E1810 with message `@acme/ui needs look "acme.badge"; spread acmeTokens.look`',
  () => {
    const d = codesOf(app(fixedTokens("", "")), "E1810");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui needs look "acme.badge"; spread acmeTokens.look');
  },
  CHECK_CASE_BOUND,
);

test("a dropped group is one E1810 for the library naming the first missing name, groups in k.ui's order with `look` last, `and <n> more` counting the rest", () => {
  const noColor = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\nexport const tokens = defineTokens({ ...brandTokens, look: { ...brandTokens.look, ...acmeTokens.look } });\n`;
  const d = codesOf(app(noColor), "E1810");
  expect(d).toHaveLength(1);
  expect(d[0]?.message).toBe('@acme/ui needs color "acme.accent" and 1 more; spread acmeTokens.color');
});

test(
  "In the fixture with no `tokens.ts`, `keel check` reports one E1810 at the `'@acme/ui'` entry, with no fix",
  () => {
    const files = app(undefined);
    const d = codesOf(files, "E1810");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/shop/module.ts");
    expect(atText(sourceOf(files, "modules/shop/module.ts"), "'@acme/ui'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "an app that lists no library with a `./tokens` entry has no E1810, with or without `tokens.ts`",
  () => {
    const noEntry = acme([
      {
        path: "node_modules/@acme/ui/package.json",
        source: JSON.stringify({
          name: "@acme/ui",
          version: "1.0.0",
          type: "module",
          keel: "library",
          exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
        }),
      },
    ]);
    for (const tokens of [undefined, BRAND_ONLY]) {
      const files = [...app(tokens).filter((f) => !f.path.startsWith("node_modules/")), ...noEntry];
      expect(codesOf(files, "E1810")).toEqual([]);
    }
  },
  CHECK_CASE_BOUND,
);
