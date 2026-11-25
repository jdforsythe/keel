// Spec: k.module, clause "A page of `b` naming a layout of `a`, where `a` lists `b` in `deps`, reports no E1152 and no E1153; `a` and `b` listing each other produce one E1153 naming both."
// Seed 1337: the module ids are generated.
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, type Files, codesOf, lowerId, manifestFile } from "./module-support.ts";
import { CHECK_CASE_BOUND } from "./check-time.ts";

const distinct = fc.tuple(lowerId, lowerId).filter(([a, b]) => a !== b);

const contract = (id: string, entries: string): Files[number] => ({
  path: `modules/${id}/${id}.contract.ts`,
  source: `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { ${entries} })\n`,
});
const binding = (id: string, entries: string): Files[number] => ({
  path: `modules/${id}/routes.ts`,
  source: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${id}, { ${entries} })\n`,
});

/** `a` holds the layout `a.frame`; a page of `b` names it. */
const files = (a: string, b: string, aDeps: string[], bDeps: string[]): Files => [
  manifestFile({ id: a, deps: aDeps }),
  contract(a, `'${a}.frame': { layout: true }`),
  binding(a, `'${a}.frame': { component: Page }`),
  manifestFile({ id: b, deps: bDeps }),
  contract(b, `'${b}.home': { path: '/' }`),
  binding(b, `'${b}.home': { component: Page, layout: '${a}.frame' }`),
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['${a}', '${b}'], adapter: 'node' } })\n`,
  },
];

test(
  "a page of `b` naming a layout of `a`, where `a` lists `b` in `deps`, reports no E1152 and no E1153",
  () => {
    fc.assert(
      fc.property(distinct, ([a, b]) => {
        const f = files(a, b, [b], []);
        expect(codesOf(f, "E1152")).toEqual([]);
        expect(codesOf(f, "E1153")).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "`a` and `b` listing each other in `deps`, with a page of `b` naming a layout of `a`, produce one E1153 naming both and no E1152",
  () => {
    fc.assert(
      fc.property(distinct, ([a, b]) => {
        const f = files(a, b, [b], [a]);
        const d = codesOf(f, "E1153");
        expect(d.length).toBe(1);
        expect(d[0]?.message).toContain(a);
        expect(d[0]?.message).toContain(b);
        expect(codesOf(f, "E1152")).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  CHECK_CASE_BOUND,
);
