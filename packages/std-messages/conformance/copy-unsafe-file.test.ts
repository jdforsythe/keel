// Spec: std.copy, Files "Every app `*.tsx` file of the module, with or without `export default` and whatever its name, and its `routes.ts` (the route `title` only). Calls (below) are read in every app file of the module except the set's locale files. Tests and `.keel/` are not read; a file under `unsafe/` is read whole, its `unsafe(` calls included (k.check App code)."
// Spec: std.copy, Conformance "In a module listing `@keel/std-messages`, `<Input placeholder="Search" />` in `modules/m/unsafe/Field.tsx` is one E2406 at the file's top level and one inside the arrow function given to `unsafe('r', () => ...)`."
// Seed 1337 (the property below). The fixture is a project of one module `m` listing `@keel/std-messages`; the `unsafe` call is built from a constant so this file's own source holds no literal call.
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codesOf } from "./fixtures/copy-support.ts";

const U = "unsafe";
const MODULE_M = `import { module } from '@keel/compiler'
export default module({ id: 'm', deps: ['@keel/std-messages'], capabilities: [], public: { exports: [] } })
`;
const HELPER = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\n`;
const FIELD = "modules/m/unsafe/Field.tsx";
const e2406 = (source: string, path = FIELD) =>
  codesOf(
    [
      { path: "modules/m/module.ts", source: MODULE_M },
      { path, source },
    ],
    "E2406",
  );
const word = fc.stringMatching(/^[A-Z][a-z]{2,9}$/);
const reason = fc.stringMatching(/^[a-z][a-z ]{2,20}$/);

test('In a module listing `@keel/std-messages`, `<Input placeholder="Search" />` in `modules/m/unsafe/Field.tsx` is one E2406 at the file\'s top level', () => {
  const src = `${HELPER}export function Field() { return <Input placeholder="Search" /> }\n`;
  const d = e2406(src);
  expect(d).toHaveLength(1);
  expect(d[0]?.path).toBe(FIELD);
  expect(d[0]?.line).toBe(src.split("\n").findIndex((l) => l.includes("Search")) + 1);
});

test("and one inside the arrow function given to `unsafe('r', () => ...)`: a justification does not lift E2406", () => {
  const src = `${HELPER}export const Field = ${U}('r', () => <Input placeholder="Search" />)\n`;
  const d = e2406(src);
  expect(d).toHaveLength(1);
  expect(d[0]?.line).toBe(src.split("\n").findIndex((l) => l.includes("Search")) + 1);
});

test("property: for any word and reason, the literal is one E2406 outside a range and one inside it, and the same file at `modules/m/Field.tsx` agrees", () => {
  fc.assert(
    fc.property(word, reason, (w, why) => {
      const outside = `${HELPER}export function Field() { return <Input placeholder="${w}" /> }\n`;
      const inside = `${HELPER}export const Field = ${U}('${why}', () => <Input placeholder="${w}" />)\n`;
      expect(e2406(outside)).toHaveLength(1);
      expect(e2406(inside)).toHaveLength(1);
      expect(e2406(outside, "modules/m/Field.tsx")).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
