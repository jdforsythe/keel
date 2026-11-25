// Spec: k.routes, clause "With module `app` (deps `['shop']`) holding a layout `app.frame` and module `shop` (deps `[]`) a page bound with `layout: 'app.frame'`, `keel check` reports no E1152 and no E1153 and the page renders inside `app.frame`'s component; with `app`'s `deps` `[]` as well, one E1152 at `layout`."
// Seed 1337: the module ids are generated.
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, type Files, codesOf, lowerId, manifestFile } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId).filter(([a, b]) => a !== b);

const contract = (id: string, entries: string): Files[number] => ({
  path: `modules/${id}/${id}.contract.ts`,
  source: `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { ${entries} })\n`,
});
const binding = (id: string, entries: string): Files[number] => ({
  path: `modules/${id}/routes.ts`,
  source: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${id}, { ${entries} })\n`,
});
const topo = (...ms: string[]): Files[number] => ({
  path: "topology.ts",
  source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: [${ms.map((m) => `'${m}'`).join(", ")}], adapter: 'node' } })\n`,
});

/** `frame` holds the layout `<frame>.frame` (deps `frameDeps`); `page` binds a page with `layout: '<frame>.frame'` (deps `pageDeps`). */
function app(frame: string, page: string, frameDeps: string[], pageDeps: string[]): Files {
  return [
    manifestFile({ id: frame, deps: frameDeps }),
    contract(frame, `'${frame}.frame': { layout: true }`),
    binding(frame, `'${frame}.frame': { component: Page }`),
    manifestFile({ id: page, deps: pageDeps }),
    contract(page, `'${page}.home': { path: '/' }`),
    binding(page, `'${page}.home': { component: Page, layout: '${frame}.frame' }`),
    topo(frame, page),
  ];
}

test("keel check reports no E1152 for a page naming a layout of a module that lists the page's module in `deps`", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      expect(codesOf(app(a, b, [b], []), "E1152")).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("keel check reports no E1153 for a frame module that lists the page's module in `deps` and a page that names its layout", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      expect(codesOf(app(a, b, [b], []), "E1153")).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("with neither module listing the other in `deps`, keel check reports one E1152 at the page's `layout`", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const d = codesOf(app(a, b, [], []), "E1152").filter((x) => x.path === `modules/${b}/routes.ts`);
      expect(d.length).toBe(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a page's module listing the layout's module in `deps` still reports no E1152", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      expect(codesOf(app(a, b, [], [a]), "E1152")).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
