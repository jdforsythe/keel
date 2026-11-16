// Spec: k.persist, Rules "E1551 (k.server) also covers `commitStores` outside `*.server.ts`, and reads app files only: no test, tool config (`*.config.*`), or file under `unsafe/`, `.keel/`, `node_modules/` or the root's `packages/` (kernel and stdlib code)."
// Spec: k.persist, Conformance "A `commitStores` call and a `loader` call in `packages/p/src/run.ts` are no E1551; the same file at `modules/a/run.ts` is two."
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MANIFEST = `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const SOURCE = `import { commitStores } from '@keel/server'
import { loader } from '@keel/router'
declare const ctx: never
declare const factory: never
declare const Out: unknown
export const save = () => commitStores(ctx, factory, () => undefined)
export const load = loader({ output: Out }, async () => 1)
`;

const found = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1551");
const at = (path: string): Files => [
  { path: "modules/a/module.ts", source: MANIFEST },
  { path, source: SOURCE },
];

test("A `commitStores` call and a `loader` call in `packages/p/src/run.ts` are no E1551; the same file at `modules/a/run.ts` is two.", () => {
  expect(found(at("packages/p/src/run.ts")).length).toBe(0);
  const d = found(at("modules/a/run.ts"));
  expect(d.length).toBe(2);
  for (const x of d) expect(x.path).toBe("modules/a/run.ts");
});

test("E1551 covers `commitStores` outside `*.server.ts`: the same source at `modules/a/run.server.ts` is none.", () => {
  expect(found(at("modules/a/run.server.ts")).length).toBe(0);
});

test.each([
  "node_modules/x/run.ts",
  ".keel/run.ts",
  "modules/a/unsafe/run.ts",
  "modules/a/run.test.ts",
  "modules/a/vitest.config.ts",
])(
  "E1551 reads app files only: no test, tool config, or file under `unsafe/`, `.keel/`, `node_modules/` or `packages/`: %s is none.",
  (path) => {
    expect(found(at(path)).length).toBe(0);
  },
);

test("E1551 reads app files only: for any package and file name, `packages/<pkg>/src/<name>.ts` is none and `modules/<pkg>/<name>.ts` is two.", () => {
  const word = fc.stringMatching(/^[a-z]{3,10}$/);
  fc.assert(
    fc.property(word, word, (pkg, name) => {
      expect(found([{ path: `packages/${pkg}/src/${name}.ts`, source: SOURCE }]).length).toBe(0);
      const d = found([
        { path: `modules/${pkg}/module.ts`, source: MANIFEST.replace("'a'", `'${pkg}'`) },
        { path: `modules/${pkg}/${name}.ts`, source: SOURCE },
      ]);
      expect(d.length).toBe(2);
      for (const x of d) expect(x.path).toBe(`modules/${pkg}/${name}.ts`);
    }),
    { seed: SEED, numRuns: 30 },
  );
});
