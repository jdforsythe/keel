// k.a11y Required props ("A blank literal `label` (no visible character, as std.text `line` defines it; a `Cc` control or JSX named reference is not one) is E1802 too; a computed one is unchecked") and
// Spec: k.a11y, clause "`keel check` without types reports E1802 for `<Box as=\"nav\" label=\"\">` and `Input({ label: \" \" })`; `label=\"Main\"`, `label={name}` and a `store` option `label: \"\"` report none."
// Seed 1337
// E1802 for a blank label has no fix: the name is the author's choice.
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

const UI = `import { Box, Input, Select, Checkbox } from '@keel/ui'\n`;
const tsx = (body: string, head = UI) =>
  f("modules/app/View.tsx", `${head}export const View = (name: string, x: string) => (\n  ${body}\n)\n`);
const ts = (body: string, head = UI) => f("modules/app/view.ts", `${head}export const v = ${body}\n`);

const expectBlank = (files: Files) => {
  const ds = e1802(files);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.see).toBe("k.a11y");
  expect(ds[0]?.fix).toBeUndefined();
};

test('`keel check` without types reports E1802 for `<Box as="nav" label="">`', () => {
  expectBlank([tsx(`<Box as="nav" label="">x</Box>`)]);
});

test('`keel check` without types reports E1802 for `<Box as="aside" label={"  "}>`', () => {
  expectBlank([tsx(`<Box as="aside" label={"  "}>x</Box>`)]);
});

test('`keel check` without types reports E1802 for `Box({ as: "nav", label: "" })` in a .ts file', () => {
  expectBlank([ts(`Box({ as: "nav", label: "" })`)]);
});

test('`keel check` without types reports E1802 for `Input({ label: " " })`', () => {
  expectBlank([ts(`Input({ label: " " })`)]);
});

test("`keel check` without types reports E1802 for `<Select label={``} ...>`", () => {
  expectBlank([tsx("<Select label={``} options={[]} />")]);
});

test('`keel check` without types reports E1802 for `<Checkbox label={"\\t"} ...>`', () => {
  expectBlank([tsx(`<Checkbox label={"\\t"} checked={false} />`)]);
});

test('`keel check` without types reports no E1802 for `<Checkbox label="\\t" ...>`, a JSX attribute string of backslash and t', () => {
  expect(e1802([tsx(`<Checkbox label="\\t" checked={false} />`)])).toHaveLength(0);
});

test("E1802 for a blank label follows an aliased `@keel/ui` import", () => {
  expectBlank([tsx(`<B as="nav" label="" />`, `import { Box as B } from '@keel/ui'\n`)]);
});

test('`keel check` without types reports no E1802 for `label="Main"`', () => {
  expect(e1802([tsx(`<Box as="nav" label="Main">x</Box>`)])).toHaveLength(0);
});

test("`keel check` without types reports no E1802 for `label={name}`", () => {
  expect(e1802([tsx(`<Box as="nav" label={name}>x</Box>`)])).toHaveLength(0);
});

test("`keel check` without types reports no E1802 for a template literal with a substitution, `label={`${x}`}`", () => {
  expect(e1802([tsx('<Box as="nav" label={`${x}`}>x</Box>')])).toHaveLength(0);
});

test('`keel check` without types reports no E1802 for a `Select` option\'s `label: ""`', () => {
  expect(e1802([ts(`Select({ label: "Pick", options: [{ value: "a", label: "" }] })`)])).toHaveLength(0);
});

test('`keel check` without types reports no E1802 for a `store` option `label: ""`', () => {
  const src = `import { store } from '@keel/store'\nexport const cart = store({}, { label: '' })\n`;
  expect(e1802([f("modules/app/cart.ts", src)])).toHaveLength(0);
});

test('`keel check` without types reports no E1802 for a non-`@keel/ui` component\'s `label=""`', () => {
  const head = `import { Box } from './Box.tsx'\n`;
  expect(e1802([tsx(`<Box as="nav" label="">x</Box>`, head)])).toHaveLength(0);
});

test("E1802 fires for a `label` of any generated white-space string, in JSX and in a call", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[ \t\r\n  　]*$/), (ws) => {
      const lit = JSON.stringify(ws);
      if (/^ *$/.test(ws)) {
        expect(e1802([tsx(`<Box as="nav" label="${ws}">x</Box>`)])).toHaveLength(1);
      }
      expect(e1802([tsx(`<Box as="nav" label={${lit}}>x</Box>`)])).toHaveLength(1);
      expect(e1802([ts(`Input({ label: ${lit} })`)])).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("E1802 does not fire for a generated label with a visible character", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/), (name) => {
      expect(e1802([tsx(`<Box as="nav" label="${name}">x</Box>`)])).toHaveLength(0);
      expect(e1802([ts(`Input({ label: "${name}" })`)])).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 50 },
  );
});
