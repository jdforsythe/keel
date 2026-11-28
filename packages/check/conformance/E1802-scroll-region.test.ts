// Spec: k.a11y, clause "`keel check` without types reports E1802 for `<Box scroll=\"x\">`, for `<Box scroll=\"x\" label=\"Prices\" labelledBy=\"t\">` and for `<Box scroll=\"x\" label=\" \">`; `label=\"Prices\"`, `label={name}` and `labelledBy=\"t\"` report none."
// k.a11y, Required props "`label` or `labelledBy`, exactly one, on `Box scroll`"
// Seed 1337
// Not built yet (rfc:0203): the E1802 cases fail until the check rule covers `Box scroll`; plain `test`, not skipped. The "report none" cases pass today and keep passing.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n`,
);
const e1802 = (files: Files) =>
  check([MANIFEST, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1802");

const UI = `import { Box } from '@keel/ui'\n`;
const tsx = (body: string, head = UI) =>
  f("modules/app/View.tsx", `${head}export const View = (name: string) => (\n  ${body}\n)\n`);
const ts = (body: string) => f("modules/app/view.ts", `${UI}export const v = ${body}\n`);

test('`keel check` without types reports E1802 for `<Box scroll="x">`', () => {
  const ds = e1802([tsx(`<Box scroll="x">x</Box>`)]);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.see).toBe("k.a11y");
});

test('`keel check` without types reports E1802 for `<Box scroll="x" label="Prices" labelledBy="t">`', () => {
  expect(e1802([tsx(`<Box scroll="x" label="Prices" labelledBy="t">x</Box>`)])).toHaveLength(1);
});

test('`keel check` without types reports E1802 for `<Box scroll="x" label=" ">`', () => {
  expect(e1802([tsx(`<Box scroll="x" label=" ">x</Box>`)])).toHaveLength(1);
});

test('`keel check` without types reports no E1802 for `<Box scroll="x" label="Prices">`', () => {
  expect(e1802([tsx(`<Box scroll="x" label="Prices">x</Box>`)])).toHaveLength(0);
});

test('`keel check` without types reports no E1802 for `<Box scroll="x" label={name}>`', () => {
  expect(e1802([tsx(`<Box scroll="x" label={name}>x</Box>`)])).toHaveLength(0);
});

test('`keel check` without types reports no E1802 for `<Box scroll="x" labelledBy="t">`', () => {
  expect(e1802([tsx(`<Box scroll="x" labelledBy="t">x</Box>`)])).toHaveLength(0);
});

test('E1802 for a `Box scroll` also fires in a call, `Box({ scroll: "x" })`, and not for a call with a name', () => {
  expect(e1802([ts(`Box({ scroll: "x" })`)])).toHaveLength(1);
  expect(e1802([ts(`Box({ scroll: "x", label: "Prices" })`)])).toHaveLength(0);
  expect(e1802([ts(`Box({ scroll: "x", labelledBy: "t" })`)])).toHaveLength(0);
});

test("E1802 for a `Box scroll` follows an aliased `@keel/ui` import", () => {
  expect(e1802([tsx(`<B scroll="x">x</B>`, `import { Box as B } from '@keel/ui'\n`)])).toHaveLength(1);
});

test('E1802 does not fire for a non-`@keel/ui` component\'s `scroll="x"` with no name', () => {
  expect(e1802([tsx(`<Box scroll="x">x</Box>`, `import { Box } from './Box.tsx'\n`)])).toHaveLength(0);
});

test("a `Box scroll` named by a generated visible label reports none, by a generated blank one reports E1802 (property)", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/), fc.stringMatching(/^ {1,6}$/), (name, blank) => {
      expect(e1802([tsx(`<Box scroll="x" label="${name}">x</Box>`)])).toHaveLength(0);
      expect(e1802([tsx(`<Box scroll="x" labelledBy="${name}">x</Box>`)])).toHaveLength(0);
      expect(e1802([tsx(`<Box scroll="x" label="${blank}">x</Box>`)])).toHaveLength(1);
      expect(e1802([tsx(`<Box scroll="x" label="${name}" labelledBy="${name}">x</Box>`)])).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 40 },
  );
});
