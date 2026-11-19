// Spec: k.module Rules (RFC 0080): E1152 "import from, `href()` or `service` into, a module not in `deps`" and
// E1157 "`href()` or `service` to a non-public route of another module". Seed 1337.
// ASSUMPTION: the checker matches a `service({ module })` endpoint's literal `path` to the route of that module with the same path
// (routesFile gives route `<id>.<name>` the path `/<id>/<name>`); the caller's `schema` is a sibling `*.schema.ts` of literals.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, codesOf, has, lowerId, manifestFile, routesFile } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, lowerId, lowerId).filter(([a, b, x, y]) => a !== b && x !== y);

const caller = (a: string, b: string, route: string) => [
  {
    path: `modules/${a}/BApi.schema.ts`,
    source: `import { endpoints } from '@keel/services'\nimport { s } from '@keel/schema'\nexport const BApi = endpoints({ get: { method: 'GET', path: '/${b}/${route}', output: s.json() } })\n`,
  },
  {
    path: `modules/${a}/api.ts`,
    source: `import { service } from '@keel/services'\nimport { BApi } from './BApi.schema.ts'\nexport const api = service({ module: '${b}', schema: BApi })\n`,
  },
];

const mk = (a: string, b: string, pub: string, priv: string, target: string, deps: string[]) => [
  manifestFile({ id: b, exports: ["routes"], routes: [`${b}.${pub}`] }),
  routesFile(b, [`${b}.${pub}`, `${b}.${priv}`]),
  manifestFile({ id: a, deps }),
  ...caller(a, b, target),
];

describe("k.module: service({ module }) access", () => {
  test("E1152 import from, `href()` or `service` into, a module not in `deps` (fix adds it)", () => {
    fc.assert(
      fc.property(distinct, ([a, b, pub, priv]) => {
        const d = codesOf(mk(a, b, pub, priv, pub, []), "E1152");
        expect(d.length).toBeGreaterThanOrEqual(1);
        expect(d[0]?.path).toBe(`modules/${a}/api.ts`);
        expect(has(mk(a, b, pub, priv, pub, [b]), "E1152")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("E1157 `href()` or `service` to a non-public route of another module (fix adds it to that module's `public.routes`)", () => {
    fc.assert(
      fc.property(distinct, ([a, b, pub, priv]) => {
        const d = codesOf(mk(a, b, pub, priv, priv, [b]), "E1157");
        expect(d.length).toBeGreaterThanOrEqual(1);
        expect(d[0]?.path).toBe(`modules/${a}/api.ts`);
        expect(has(mk(a, b, pub, priv, pub, [b]), "E1157")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
