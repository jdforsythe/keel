// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codesOf, has, lowerId, manifestFile, routesFile, SEED } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, lowerId, lowerId).filter(([a, b, x, y]) => a !== b && x !== y);

const mk = (a: string, b: string, pub: string, priv: string, target: string) => [
  manifestFile({ id: b, routes: [`${b}.${pub}`] }),
  routesFile(b, [`${b}.${pub}`, `${b}.${priv}`]),
  manifestFile({ id: a, deps: [b] }),
  {
    path: `modules/${a}/Back.ts`,
    source: `import { href } from '@keel/router'\nexport const Back = href('${b}.${target}')\n`,
  },
];

test("href() to a non-public route of another module reports E1157", () => {
  fc.assert(
    fc.property(distinct, ([a, b, pub, priv]) => {
      const d = codesOf(mk(a, b, pub, priv, priv), "E1157");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${a}/Back.ts`);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1157: href() to a public route of a dependency reports nothing", () => {
  fc.assert(
    fc.property(distinct, ([a, b, pub, priv]) => {
      expect(has(mk(a, b, pub, priv, pub), "E1157")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1157: href() to a private route of the module's own manifest reports nothing", () => {
  fc.assert(
    fc.property(lowerId, lowerId, (a, name) => {
      const files = [
        manifestFile({ id: a }),
        routesFile(a, [`${a}.${name}`]),
        {
          path: `modules/${a}/Back.ts`,
          source: `import { href } from '@keel/router'\nexport const Back = href('${a}.${name}')\n`,
        },
      ];
      expect(has(files, "E1157")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
