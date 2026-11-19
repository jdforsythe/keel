// Spec: k.topology, Rules "A project root is the root or any folder without a `modules` segment that holds a `.keel/` artifact or a `topology.ts` with a default export, readable or not; an unreadable one is E1552 at its path and the folder's files are checked as that project's"
// Seed: 1337.
// Assumption: a `topology.ts` whose default export is `topology(t)` over a variable is unreadable; an import of a private export of a sibling module is an E1151, which shows which project a module file is checked in.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { exportFile, manifestFile } from "./module-support.ts";
import { type Files, SEED } from "./support.ts";

const MANIFEST = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const ROOT = `import { topology } from '@keel/server'\nexport default topology({ root: { modules: ['a'], adapter: 'node' } })\n`;
const UNREADABLE = `import { topology } from '@keel/server'\nconst t = { web: { modules: ["a"], adapter: "node" } }\nexport default topology(t)\n`;

const e1552 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1552");

const base = (nested: string): Files => [
  { path: "topology.ts", source: ROOT },
  { path: "modules/a/module.ts", source: MANIFEST("a") },
  { path: nested, source: UNREADABLE },
];

test("An unreadable `apps/web/topology.ts` beside a readable root `topology.ts` is exactly one E1552, at `apps/web/topology.ts`.", () => {
  const d = e1552(base("apps/web/topology.ts"));
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("apps/web/topology.ts");
});

test("The folder's files are checked as that project's: faults under `apps/web/modules/` are reported at their `apps/web/` paths and the root project's findings are unchanged by the folder.", () => {
  const pair = (root: string, a: string, b: string): Files => [
    manifestFile({ id: b, exports: [] }, `${root}modules/${b}`),
    exportFile(`${root}modules/${b}`, "Secret"),
    manifestFile({ id: a, deps: [b] }, `${root}modules/${a}`),
    {
      path: `${root}modules/${a}/OrderCard.ts`,
      source: `import { Secret } from '../${b}/Secret.ts'\nexport const OrderCard = Secret\n`,
    },
  ];
  const rootFiles: Files = [{ path: "topology.ts", source: ROOT }, ...pair("", "a", "b")];
  const nested: Files = [{ path: "apps/web/topology.ts", source: UNREADABLE }, ...pair("apps/web/", "c", "d")];
  const keys = (f: Files, under: string) =>
    check(f, { types: false })
      .diagnostics.filter((d) => (under === "" ? !d.path.startsWith("apps/web/") : d.path.startsWith(under)))
      .map((d) => `${d.code} ${d.path}`)
      .sort();
  expect(keys(rootFiles, "")).toContain("E1151 modules/a/OrderCard.ts");
  expect(keys([...rootFiles, ...nested], "")).toEqual(keys(rootFiles, ""));
  expect(keys([...rootFiles, ...nested], "apps/web/")).toEqual([
    "E1151 apps/web/modules/c/OrderCard.ts",
    "E1552 apps/web/topology.ts",
  ]);
});

test("A `topology.ts` under a `modules` segment is not a project root: no E1552 for `modules/a/topology.ts`.", () => {
  expect(e1552(base("modules/a/topology.ts")).length).toBe(0);
});

test("For any folder name, an unreadable `<name>/topology.ts` beside a readable root `topology.ts` is exactly one E1552, at that path.", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{3,10}$/), (name) => {
      fc.pre(name !== "modules");
      const d = e1552(base(`${name}/topology.ts`));
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe(`${name}/topology.ts`);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("A `lib/topology.ts` with no default export is not a project root: no E1552 on it and the root's findings are unchanged.", () => {
  const rootFiles: Files = [
    { path: "topology.ts", source: ROOT },
    { path: "modules/a/module.ts", source: MANIFEST("a") },
  ];
  const withLib: Files = [...rootFiles, { path: "lib/topology.ts", source: "export function topology() {}\n" }];
  const key = (f: Files) =>
    check(f, { types: false })
      .diagnostics.map((d) => `${d.code} ${d.path}`)
      .sort();
  expect(e1552(withLib).filter((d) => d.path === "lib/topology.ts").length).toBe(0);
  expect(key(withLib)).toEqual(key(rootFiles));
});
