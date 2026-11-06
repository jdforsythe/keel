// @vitest-environment happy-dom
// Seed 1337
// Pipeline step 4 (rendered checks). axe-core vs a11y.json comparison reports E1702/E1703 under `keel test`, not here:
// untestable through check(files, opts). Only the type-level a11y rule (E1802) is asserted.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { one, SEED } from "./support.ts";

const codes = (src: string) => check(one(src), {}).diagnostics.map((d) => d.code);

test("E1802: a TS error that encodes a Keel a11y rule is reported under E1802, not E1751", () => {
  fc.assert(
    fc.property(fc.constantFrom("Input", "TextArea", "Select", "Checkbox"), (tag) => {
      const c = codes(`import { ${tag} } from '@keel/ui'\nexport default function C() { return <${tag} /> }\n`);
      expect(c).toContain("E1802");
      expect(c).not.toContain("E1751");
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("E1802: a base element with its required a11y prop reports no E1802", () => {
  const c = codes(`import { Input } from '@keel/ui'\nexport default function C() { return <Input label="Name" /> }\n`);
  expect(c).not.toContain("E1802");
});

test("a component rendered once under sim ctx with no violations adds no diagnostics", () => {
  const c = codes(`import { Button } from '@keel/ui'\nexport default function C() { return <Button>Go</Button> }\n`);
  expect(c).toEqual([]);
});
