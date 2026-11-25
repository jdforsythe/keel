// k.library Rules (E1163's manifest half, E1166) and the k.module rules that read a library by kind (E1153, E1158,
// E1165): properties over `check()` files. Seed 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ruleInScope } from "../src/internal/ruleInScope.ts";

const SEED = 1337;
const NO_TYPES = { types: false } as const;
const id = fc.stringMatching(/^[a-z]{4,9}$/);
const scoped = fc.tuple(id, id).map(([a, b]) => `@${a}/${b}`);
type File = { path: string; source: string };

const manifest = (path: string, mid: string, deps: readonly string[], std = ""): File => ({
  path,
  source: `import { module } from '@keel/compiler'\nexport default module({ id: '${mid}', deps: [${deps.map((d) => `'${d}'`).join(", ")}], capabilities: [], public: { exports: [] }${std} })\n`,
});
const app = (mid: string, deps: readonly string[], std = ""): File =>
  manifest(`modules/${mid}/module.ts`, mid, deps, std);
const library = (name: string, mid: string, deps: readonly string[] = [], keel: string | null = "library"): File[] => [
  {
    path: `node_modules/${name}/package.json`,
    source: JSON.stringify({ name, version: "1.0.0", type: "module", ...(keel === null ? {} : { keel }) }),
  },
  manifest(`node_modules/${name}/module.ts`, mid, deps),
  // A truthful ledger file, so E1162 (k.library) holds.
  {
    path: `node_modules/${name}/.keel/ledger.json`,
    source: JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, exports: [] }),
  },
];
const diags = (files: File[], code: string) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === code);

test("E1166 names the two libraries by package name, the same message at each entry", () => {
  fc.assert(
    fc.property(
      id.filter((x) => x !== "shop"),
      fc.uniqueArray(scoped, { minLength: 2, maxLength: 2 }),
      (mid, names) => {
        const files = [app("shop", names), ...names.flatMap((n) => library(n, mid))];
        const [a, b] = [...names].sort();
        const d = diags(files, "E1166");
        expect(d.map((x) => x.message)).toEqual([
          `module id ${mid} is held by ${a} and ${b}`,
          `module id ${mid} is held by ${a} and ${b}`,
        ]);
        for (const x of d) expect(x.fix).toBeUndefined();
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("a library listing an app module that lists it is one E1163 and no E1153, E1165 or E1166", () => {
  fc.assert(
    fc.property(
      scoped,
      id.filter((x) => x !== "shop"),
      (name, mid) => {
        const files = [app("shop", [name]), ...library(name, mid, ["shop"])];
        const codes = check(files, NO_TYPES).diagnostics.map((d) => d.code);
        expect(codes).toEqual(["E1163"]);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("a package without the keel mark is no library: its manifest is not read, and its entry is no E1165", () => {
  fc.assert(
    fc.property(
      scoped.filter((n) => !n.startsWith("@keel/")),
      (name) => {
        const files = [app("shop", [name]), app("other", []), ...library(name, "other", ["shop"], null)];
        const codes = check(files, NO_TYPES).diagnostics.map((d) => d.code);
        expect(codes).not.toContain("E1163");
        expect(codes).not.toContain("E1166");
        expect(codes).not.toContain("E1165");
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("a std key naming a library in deps is no E1158; one naming no deps entry is", () => {
  fc.assert(
    fc.property(scoped, (name) => {
      const std = `, std: { '${name}': { on: true } }`;
      expect(diags([app("shop", [name], std), ...library(name, "charts")], "E1158")).toEqual([]);
      expect(diags([app("shop", [], std)], "E1158")).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("a library's rule imported by importDeps runs only while the project's deps reach it", () => {
  const byDeps = new Set(["@acme/charts"]);
  expect(ruleInScope("@acme/charts", new Set(["@acme/charts"]), byDeps)).toBe(true);
  expect(ruleInScope("@acme/charts", new Set(), byDeps)).toBe(false);
  expect(ruleInScope("@acme/other", new Set(), byDeps)).toBe(true);
});
