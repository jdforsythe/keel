// Spec: k.routes, Layouts "Another module's id compiles; `routeTable`, or a manifest served alone, throws E1506 naming both ids if it names no layout entry of the table or closes a cycle. `deps` must list its module (`keel check` E1152 at `layout`)."
// Spec: RFC 0157 D13 "`keel check` reports E1152 at a `layout` whose module is not in `deps`"; k.routes Layouts: `routeTable` throws E1506 "if it names no layout entry of the table or closes a cycle", one table per deployable (a module placed in another deployable is not in the table).
// Seed 1337: the module ids are generated; the shapes (which entry, which deployable) are enumerated.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, type Files, codesOf, lowerId, manifestFile } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId).filter(([a, b]) => a !== b);
const NO_TYPES = { types: false } as const;

const contract = (id: string, entries: string): Files[number] => ({
  path: `modules/${id}/${id}.contract.ts`,
  source: `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { ${entries} })\n`,
});
const binding = (id: string, entries: string): Files[number] => ({
  path: `modules/${id}/routes.ts`,
  source: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${id}, { ${entries} })\n`,
});
const topo = (deployables: Record<string, string[]>): Files[number] => ({
  path: "topology.ts",
  source: `import { topology } from '@keel/server'\nexport default topology({ ${Object.entries(deployables)
    .map(([k, ms]) => `${k}: { modules: [${ms.map((m) => `'${m}'`).join(", ")}], adapter: 'node' }`)
    .join(", ")} })\n`,
});

/** `a` binds a page with `layout: <layout>`; `b` holds `bEntries`. */
function app(
  a: string,
  b: string,
  layout: string,
  bEntries: string,
  deps: string[],
  deployables: Record<string, string[]>,
): Files {
  return [
    manifestFile({ id: b }),
    contract(b, bEntries),
    binding(
      b,
      bEntries.includes("layout: true")
        ? `'${b}.shell': { component: Page }, '${b}.page': { component: Page }`
        : `'${b}.page': { component: Page }`,
    ),
    manifestFile({ id: a, deps }),
    contract(a, `'${a}.home': { path: '/' }`),
    binding(a, `'${a}.home': { component: Page, layout: '${layout}' }`),
    topo(deployables),
  ];
}
const withShell = (b: string): string => `'${b}.shell': { layout: true }, '${b}.page': { path: '/p' }`;

test("keel check reports E1152 at a `layout` naming a layout of a module missing from `deps`", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const files = app(a, b, `${b}.shell`, withShell(b), [], { web: [a, b] });
      const d = codesOf(files, "E1152").filter((x) => x.path === `modules/${a}/routes.ts`);
      expect(d.length).toBeGreaterThanOrEqual(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("the E1152 at a foreign `layout` clears when the fix adds the module to `deps`", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const bad = app(a, b, `${b}.shell`, withShell(b), [], { web: [a, b] });
      const d = codesOf(bad, "E1152").find((x) => x.path === `modules/${a}/routes.ts`);
      expect(d).toBeDefined();
      expect(d?.fix).toBeDefined();
      const fixed = app(a, b, `${b}.shell`, withShell(b), [b], { web: [a, b] });
      expect(codesOf(fixed, "E1152")).toEqual([]);
      expect(codesOf(fixed, "E1506")).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1506 per deployable's table: a foreign `layout` naming a page of its module, not a layout entry, is reported", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const files = app(a, b, `${b}.page`, withShell(b), [b], { web: [a, b] });
      expect(codesOf(files, "E1506").length).toBeGreaterThanOrEqual(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1506 per deployable's table: a foreign `layout` naming no entry of its module is reported", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const files = app(a, b, `${b}.ghost`, withShell(b), [b], { web: [a, b] });
      expect(codesOf(files, "E1506").length).toBeGreaterThanOrEqual(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1506 per deployable's table: a foreign `layout` whose module is placed in another deployable is reported, and is clean when both share one", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const split = app(a, b, `${b}.shell`, withShell(b), [b], { web: [a], api: [b] });
      expect(codesOf(split, "E1506").length).toBeGreaterThanOrEqual(1);
      const shared = app(a, b, `${b}.shell`, withShell(b), [b], { web: [a, b] });
      expect(codesOf(shared, "E1506")).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1506 per deployable's table: a foreign `layout` that closes a cycle across modules is reported", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const files: Files = [
        manifestFile({ id: a, deps: [b] }),
        contract(a, `'${a}.shell': { layout: true }`),
        binding(a, `'${a}.shell': { component: Page, layout: '${b}.shell' }`),
        manifestFile({ id: b, deps: [a] }),
        contract(b, `'${b}.shell': { layout: true }`),
        binding(b, `'${b}.shell': { component: Page, layout: '${a}.shell' }`),
        topo({ web: [a, b] }),
      ];
      expect(codesOf(files, "E1506").length).toBeGreaterThanOrEqual(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("a foreign `layout` naming a layout entry of a module in the same deployable's table, listed in `deps`, is no E1506 and no E1152", () => {
  const files = app("a", "b", "b.shell", withShell("b"), ["b"], { web: ["a", "b"] });
  const codes = check(files, NO_TYPES).diagnostics.map((d) => d.code);
  expect(codes).not.toContain("E1506");
  expect(codes).not.toContain("E1152");
});
