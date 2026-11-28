// k.module the E1171 rule and its conformance clause, each quoted whole
// Spec: k.module, clause "`modules/a/sub/module.ts` beside `modules/a/module.ts` is one E1171, as `src/fmt/module.ts` and `unsafe/module.ts` of a library are, and a rule finding the module of `modules/a/sub/x.ts` (or the library's `src/fmt/fmt.ts`) by the longest `module.ts` folder prefix of the project it is given finds `modules/a/module.ts` (the library's root manifest)."
// Rules: E1171 "a `module.ts` (any code extension) other than a manifest: in an app, one deeper than `modules/<id>/module.ts`; in a library (k.library), one under `src/` or `unsafe/`, as installed and in its own folder, so `keel pack` refuses it (message `this module.ts is no manifest; modules/<id>/ or a library's root holds the manifest`; fix: none). No rule's project holds such a file, so none takes it for the manifest of the files beside it."
// Seed 1337
// ASSUMPTIONS (spec silent): a library "as installed" is `node_modules/@acme/charts/` (library-manifest.test.ts's project) and "in its own folder" is the cli's (library-E1171-pack.test.ts); "any code extension" is `.ts`, `.tsx`, `.mts`, `.js`;
// a rule's `project` for a library file reads the library's root manifest at `modules/<id>/module.ts` (k.library In an app), and the library's `src/fmt/fmt.ts` as `modules/charts/src/fmt/fmt.ts`; the nested file holds a manifest's text.
import { check, defineRule } from "@keel/check";
import type { SourceFile } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, lowerId, manifestFile, manifestSource } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const MESSAGE = "this module.ts is no manifest; modules/<id>/ or a library's root holds the manifest";
const ROOT = "node_modules/@acme/charts";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;

const e1171 = (files: Files) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1171");

/** A library `@acme/charts` of id `charts` under `node_modules/`, `extra` its other files. */
const withLibrary = (extra: Files): Files => [
  manifestFile({ id: "shop", deps: ["@acme/charts"] }),
  {
    path: `${ROOT}/package.json`,
    source: JSON.stringify({
      name: "@acme/charts",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
    }),
  },
  { path: `${ROOT}/index.js`, source: "export {}\n" },
  manifestFile({ id: "charts", deps: [], exports: [] }, ROOT),
  { path: `${ROOT}/src/index.ts`, source: "export {}\n" },
  { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ...extra,
];
const nested = (path: string) => ({ path, source: manifestSource({ id: "other" }) });

test("`modules/a/sub/module.ts` beside `modules/a/module.ts` is one E1171", () => {
  const d = e1171([manifestFile({ id: "a" }), nested("modules/a/sub/module.ts")]);
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("modules/a/sub/module.ts");
});

test("E1171: the message is `this module.ts is no manifest; modules/<id>/ or a library's root holds the manifest` and it has no fix", () => {
  const d = e1171([manifestFile({ id: "a" }), nested("modules/a/sub/module.ts")]);
  expect(d[0]?.message).toBe(MESSAGE);
  expect(d[0]?.fix).toBeUndefined();
});

test("E1171: a `module.ts` deeper than `modules/<id>/module.ts` in an app is one E1171, whatever the id, the depth and the code extension", () => {
  fc.assert(
    fc.property(
      lowerId,
      fc.array(lowerId, { minLength: 1, maxLength: 3 }),
      fc.constantFrom("ts", "tsx", "mts", "js"),
      (id, dirs, ext) => {
        const path = `modules/${id}/${dirs.join("/")}/module.${ext}`;
        const d = e1171([manifestFile({ id }), nested(path)]);
        expect(d.map((x) => x.path)).toEqual([path]);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1171: `modules/<id>/module.ts` itself, the manifest, is no E1171", () => {
  fc.assert(
    fc.property(lowerId, (id) => {
      expect(e1171([manifestFile({ id })])).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`src/fmt/module.ts` of a library is one E1171", () => {
  const d = e1171(withLibrary([nested(`${ROOT}/src/fmt/module.ts`)]));
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(`${ROOT}/src/fmt/module.ts`);
  expect(d[0]?.message).toBe(MESSAGE);
  expect(d[0]?.fix).toBeUndefined();
});

test("`unsafe/module.ts` of a library is one E1171", () => {
  const d = e1171(withLibrary([nested(`${ROOT}/unsafe/module.ts`)]));
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(`${ROOT}/unsafe/module.ts`);
  expect(d[0]?.message).toBe(MESSAGE);
  expect(d[0]?.fix).toBeUndefined();
});

test("E1171: a library's root `module.ts`, its manifest, is no E1171", () => {
  expect(e1171(withLibrary([]))).toEqual([]);
});

/** The module id a rule finds for `path`: the longest `module.ts` folder prefix among the `project` paths it is given. */
const moduleOf = (project: readonly SourceFile[], path: string): string | undefined => {
  const folders = project
    .map((f) => f.path)
    .filter((p) => p === "module.ts" || p.endsWith("/module.ts"))
    .map((p) => p.slice(0, p.length - "module.ts".length));
  const hit = folders.filter((fo) => path.startsWith(fo)).sort((x, y) => y.length - x.length)[0];
  return hit === undefined ? undefined : `${hit}module.ts`;
};

const seen = new Map<string, readonly SourceFile[]>();
defineRule({
  code: "E2913",
  message: "project probe",
  see: "k.module",
  explain: "Records the project files a rule receives.",
  check: ({ file, project }) => {
    seen.set(file.path, project);
    return [];
  },
});

test("a rule finding the module of `modules/a/sub/x.ts` by the longest `module.ts` folder prefix of the project it is given finds `modules/a/module.ts`", () => {
  seen.clear();
  check(
    [
      manifestFile({ id: "a" }),
      nested("modules/a/sub/module.ts"),
      { path: "modules/a/sub/x.ts", source: "export const x = 1\n" },
    ],
    NO_TYPES,
  );
  const project = seen.get("modules/a/sub/x.ts");
  expect(project).toBeDefined();
  expect((project ?? []).map((f) => f.path)).not.toContain("modules/a/sub/module.ts");
  expect(moduleOf(project ?? [], "modules/a/sub/x.ts")).toBe("modules/a/module.ts");
});

test("a rule finding the module of the library's `src/fmt/fmt.ts` by the longest `module.ts` folder prefix finds the library's root manifest", () => {
  seen.clear();
  check(
    withLibrary([
      nested(`${ROOT}/src/fmt/module.ts`),
      { path: `${ROOT}/src/fmt/fmt.ts`, source: "export const fmt = 1\n" },
    ]),
    NO_TYPES,
  );
  const project = seen.get("modules/charts/src/fmt/fmt.ts");
  expect(project).toBeDefined();
  expect((project ?? []).map((f) => f.path)).not.toContain("modules/charts/src/fmt/module.ts");
  expect(moduleOf(project ?? [], "modules/charts/src/fmt/fmt.ts")).toBe("modules/charts/module.ts");
});

test("E1171: no rule's project holds the `module.ts` it reports, so none takes it for the manifest of the files beside it (any depth)", () => {
  fc.assert(
    fc.property(lowerId, fc.array(lowerId, { minLength: 1, maxLength: 3 }), (id, dirs) => {
      seen.clear();
      const sub = `modules/${id}/${dirs.join("/")}`;
      check(
        [manifestFile({ id }), nested(`${sub}/module.ts`), { path: `${sub}/x.ts`, source: "export const x = 1\n" }],
        NO_TYPES,
      );
      const project = seen.get(`${sub}/x.ts`) ?? [];
      expect(project.map((f) => f.path)).not.toContain(`${sub}/module.ts`);
      expect(moduleOf(project, `${sub}/x.ts`)).toBe(`modules/${id}/module.ts`);
    }),
    { seed: SEED, numRuns: 15 },
  );
});
