// Seed 1337
// rfc:0023: `keel check` is static only. Rendered a11y (axe vs a11y.json, E1702/E1703) is `keel test`; here only the
// type-level a11y rule (E1802) is asserted, and `check()` is shown never to evaluate app code.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, one } from "./support.ts";

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

test("check() never evaluates app code: a module that throws at top level yields only static diagnostics", () => {
  const src = `import { Button } from '@keel/ui'\nthrow new Error('evaluated')\nexport default function C() { return <Button>Go</Button> }\n`;
  expect(() => check(one(src), {})).not.toThrow();
  expect(codes(src)).not.toContain("E1756");
  const clean = codes(
    `import { Button } from '@keel/ui'\nexport default function C() { return <Button>Go</Button> }\n`,
  );
  expect(clean).toEqual([]);
});
