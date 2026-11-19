import { check } from "@keel/check";
// Spec: k.module, clause "Changing the signature of a non-public export produces no diagnostic in any other module."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, lowerId, manifestFile, pascal } from "./module-support.ts";

const bodies = [
  "(x: number) => x",
  "(x: string, y: boolean) => y",
  "{ a: 1, b: [2] }",
  "async () => 'done'",
  "class Foo { n = 1 }",
];

const distinct = fc.tuple(lowerId, lowerId, pascal, pascal).filter(([a, b, x, y]) => a !== b && x !== y);

test("changing the signature of a non-public export produces no diagnostic in any other module", () => {
  fc.assert(
    fc.property(distinct, fc.constantFrom(...bodies), fc.constantFrom(...bodies), ([a, b, secret, pub], v1, v2) => {
      const mk = (body: string) => [
        manifestFile({ id: b, exports: [pub] }),
        { path: `modules/${b}/${secret}.ts`, source: `export const ${secret} = ${body}\n` },
        { path: `modules/${b}/${pub}.ts`, source: `export const ${pub} = 1\n` },
        manifestFile({ id: a, deps: [b] }),
        {
          path: `modules/${a}/OrderCard.ts`,
          source: `import { ${pub} } from '../${b}/${pub}.ts'\nexport const OrderCard = ${pub}\n`,
        },
      ];
      const other = (body: string) =>
        check(mk(body), {}).diagnostics.filter((d) => !d.path.startsWith(`modules/${b}/`));
      expect(other(v2)).toEqual(other(v1));
    }),
    { seed: SEED, numRuns: 25 },
  );
});
