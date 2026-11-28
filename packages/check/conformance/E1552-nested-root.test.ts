// k.topology, Rules "A project root is the root or any folder without a `modules` or `node_modules` segment, outside every folder whose `package.json` marks it a library (k.library Kind), that holds a `.keel/` artifact or a `topology.ts` with a default export, readable or not; an unreadable one is E1552 at its path and the folder's files are checked as that project's"
// k.library, Kind "A folder so marked in the project's tree is no project but a library in place, read once by real path (k.supervise)."
// Seed: 1337.
// Assumption: a `topology.ts` whose default export is `topology(t)` over a variable is unreadable; an import of a private export of a sibling module is an E1151, which shows which project a module file is checked in.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { exportFile, manifestFile } from "./module-support.ts";
import { type Files, SEED } from "./support.ts";

const MANIFEST = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
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

const LIBRARY_PKG =
  '{"name":"@fx/sup","version":"0.0.0","type":"module","keel":"library","exports":{".":{"keel":"./src/index.ts"}}}';
const PLAIN_PKG = '{"name":"@fx/sup","version":"0.0.0","type":"module","exports":{".":{"keel":"./src/index.ts"}}}';
const LEDGER = '{"version":1,"unsafe":0,"hostElements":0,"exports":[]}';
const inFolder = (pkg: string): Files => [
  { path: "topology.ts", source: ROOT },
  { path: "modules/a/module.ts", source: MANIFEST("a") },
  { path: "libs/sup/package.json", source: pkg },
  { path: "libs/sup/module.ts", source: MANIFEST("sup") },
  { path: "libs/sup/src/index.ts", source: "export const one = 1\n" },
  { path: "libs/sup/.keel/ledger.json", source: LEDGER },
  { path: "libs/sup/topology.ts", source: UNREADABLE },
];

test('A folder whose `package.json` marks it a library is never a project root: `libs/sup/` holding `"keel": "library"`, a `.keel/ledger.json` and an unreadable `topology.ts` is no E1552 at `libs/sup/topology.ts`, where the same folder without the mark is one.', () => {
  expect(e1552(inFolder(LIBRARY_PKG)).filter((d) => d.path === "libs/sup/topology.ts")).toEqual([]);
  const unmarked = e1552(inFolder(PLAIN_PKG)).filter((d) => d.path === "libs/sup/topology.ts");
  expect(unmarked.length).toBe(1);
});
