// Spec: k.a11y, clause "Without types, E1802 also fires for `<Input label={\"\u{200B}\"} />`, `label=\"&#x2800;\"`, `label={\"\u{301}\"}` and `Input({ label: \"\u{3164}\u{200D}\" })`, not for `label={\"a\u{200B}\"}`."
// Spec: k.a11y, clause "Without types, E1802 fires for `label=\"&zwnj;\"`, `label=\"&copy;\"` and `Input({ label: \"\u{1}\" })`, not for `label=\"&copy;2\"`."
// Seed 1337
// A label is blank when it holds no visible character: every character is White_Space, Default_Ignorable_Code_Point, Cf, M or U+2800.
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

const UI = `import { Input } from '@keel/ui'\n`;
const tsx = (body: string) => f("modules/app/View.tsx", `${UI}export const View = (name: string) => (\n  ${body}\n)\n`);
const ts = (body: string) => f("modules/app/view.ts", `${UI}export const v = ${body}\n`);

test('E1802 fires for `<Input label={"\\u{200B}"} />`', () => {
  expect(e1802([tsx(`<Input label={"\\u{200B}"} />`)])).toHaveLength(1);
});

test('E1802 fires for `<Input label="&#x2800;" />`', () => {
  expect(e1802([tsx(`<Input label="&#x2800;" />`)])).toHaveLength(1);
});

test('E1802 fires for `<Input label={"\\u{301}"} />`, a mark with no base', () => {
  expect(e1802([tsx(`<Input label={"\\u{301}"} />`)])).toHaveLength(1);
});

test('E1802 fires for `Input({ label: "\\u{3164}\\u{200D}" })`', () => {
  expect(e1802([ts(`Input({ label: "\\u{3164}\\u{200D}" })`)])).toHaveLength(1);
});

test('E1802 does not fire for `<Input label={"a\\u{200B}"} />`', () => {
  expect(e1802([tsx(`<Input label={"a\\u{200B}"} />`)])).toHaveLength(0);
});

test('E1802 fires for `<Input label="&zwnj;" />`', () => {
  expect(e1802([tsx(`<Input label="&zwnj;" />`)])).toHaveLength(1);
});

test('E1802 fires for `<Input label="&copy;" />`', () => {
  expect(e1802([tsx(`<Input label="&copy;" />`)])).toHaveLength(1);
});

test('E1802 fires for `Input({ label: "\\u{1}" })`', () => {
  expect(e1802([ts(`Input({ label: "\\u{1}" })`)])).toHaveLength(1);
});

test('E1802 does not fire for `<Input label="&copy;2" />`', () => {
  expect(e1802([tsx(`<Input label="&copy;2" />`)])).toHaveLength(0);
});

/** One character from each class: White_Space, Default_Ignorable_Code_Point, Cf, M, and U+2800. */
const invisible: readonly number[] = [
  0x20, 0x09, 0x0a, 0xa0, 0x2003, 0x3000, 0x200b, 0x200d, 0x2060, 0xfeff, 0xad, 0x34f, 0x115f, 0x1160, 0x3164, 0xffa0,
  0x61c, 0x200e, 0x301, 0x300, 0x20d0, 0x2800,
];
const invisibleArb = fc.array(fc.constantFrom(...invisible), { minLength: 1, maxLength: 6 });

const escaped = (cps: readonly number[]): string => cps.map((c) => `\\u{${c.toString(16)}}`).join("");
const referenced = (cps: readonly number[]): string => cps.map((c) => `&#x${c.toString(16)};`).join("");

test("E1802 fires for a `label` generated only from white space, default-ignorable, `Cf`, `M` and U+2800 characters, in a string literal, a JSX character reference and a call", () => {
  fc.assert(
    fc.property(invisibleArb, (cps) => {
      expect(e1802([tsx(`<Input label={"${escaped(cps)}"} />`)])).toHaveLength(1);
      expect(e1802([tsx(`<Input label="${referenced(cps)}" />`)])).toHaveLength(1);
      expect(e1802([ts(`Input({ label: "${escaped(cps)}" })`)])).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("E1802 does not fire for the same generated strings with one ASCII letter inserted", () => {
  fc.assert(
    fc.property(invisibleArb, fc.nat(), fc.constantFrom("a", "Z", "k"), (cps, at, letter) => {
      const i = at % (cps.length + 1);
      const code = letter.codePointAt(0) ?? 97;
      const withLetter = [...cps.slice(0, i), code, ...cps.slice(i)];
      expect(e1802([tsx(`<Input label={"${escaped(withLetter)}"} />`)])).toHaveLength(0);
      expect(e1802([tsx(`<Input label="${referenced(withLetter)}" />`)])).toHaveLength(0);
      expect(e1802([ts(`Input({ label: "${escaped(withLetter)}" })`)])).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 50 },
  );
});
