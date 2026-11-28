// std.tokens, Rules "E2201 `@keel/std-tokens/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside (no fix)"
// std.tokens, Rules "E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix)."
// Spec: std.tokens, clause "E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `tokens.opaque`."
// Spec: std.tokens, clause "`import('@keel/std-tokens/server')` outside a `*.server.ts` file is E2201; `import type` from it is not."
// std.tokens, Rules "Each reads the file's own `import`, `export ... from` and `import()`; a `require` and a helper file re-exporting the entry are not followed."
// Seed: 1337.
// Assumption: as for std.db E2151, `check()` imports nothing, so the rules register by importing `@keel/std-tokens/tools`.
// Assumption: a diagnostic is `{ code, path, line, col, message, fix?, see? }` (k.check), so "naming the deployable and its adapter" is read from `message`; there is no `data` field.
// Assumption: "tests aside" is a `*.test.ts` file; the clean twin of the E2202 case is the same file in a `node` deployable.
import { check } from "@keel/check";
import { capabilities } from "@keel/ctx";
import "@keel/std-tokens/server";
import "@keel/std-tokens/tools";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "a", deps: ["@keel/std-tokens"], capabilities: ["clock", "random"], public: { exports: [] } })
`;
const topo = (adapter: string, name = "web") => `import { topology } from "@keel/server"
export default topology({ ${name}: { modules: ["a"], adapter: "${adapter}" } })
`;
const IMPORT = `import { tokens } from "@keel/std-tokens/server"\nexport const c = tokens\n`;
const project = (path: string, source: string, adapter = "node", name = "web"): Files => [
  { path: "modules/a/module.ts", source: manifest },
  { path, source },
  { path: "topology.ts", source: topo(adapter, name) },
];
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const word = fc.stringMatching(/^[a-z]{3,10}$/);

test("E2201 `@keel/std-tokens/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside (no fix)", () => {
  fc.assert(
    fc.property(word, (name) => {
      const bad = found(project(`modules/a/${name}.ts`, IMPORT), "E2201");
      expect(bad).toHaveLength(1);
      expect(bad[0]?.path).toBe(`modules/a/${name}.ts`);
      expect(bad[0]?.fix).toBeUndefined();
      expect(found(project(`modules/a/${name}.server.ts`, IMPORT), "E2201")).toHaveLength(0);
      expect(found(project(`modules/a/${name}.test.ts`, IMPORT), "E2201")).toHaveLength(0);
      const client = `import { Digested } from "@keel/std-tokens"\nexport const h = Digested\n`;
      expect(found(project(`modules/a/${name}.ts`, client), "E2201")).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix).", () => {
  fc.assert(
    fc.property(fc.constantFrom("client", "static"), word, (adapter, deployable) => {
      const bad = found(project("modules/a/x.server.ts", IMPORT, adapter, deployable), "E2202");
      expect(bad).toHaveLength(1);
      expect(bad[0]?.fix).toBeUndefined();
      expect(bad[0]?.message).toContain(deployable);
      expect(bad[0]?.message).toContain(adapter);
      expect(found(project("modules/a/x.server.ts", IMPORT, "node", deployable), "E2202")).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `tokens.opaque`.", () => {
  expect(found(project("modules/a/x.ts", IMPORT), "E2201")).toHaveLength(1);
  expect(found(project("modules/a/x.server.ts", IMPORT), "E2201")).toHaveLength(0);
  expect(found(project("modules/a/x.server.ts", IMPORT, "client"), "E2202")).toHaveLength(1);
  expect(found(project("modules/a/x.server.ts", IMPORT, "static"), "E2202")).toHaveLength(1);
  expect(found(project("modules/a/x.server.ts", IMPORT, "node"), "E2202")).toHaveLength(0);
  expect(capabilities()).toContain("tokens.opaque");
  expect(capabilities().filter((n) => n === "tokens.opaque")).toHaveLength(1);
});

test("`import('@keel/std-tokens/server')` outside a `*.server.ts` file is E2201; `import type` from it is not.", () => {
  const dynamic = `export const f = () => import("@keel/std-tokens/server")\n`;
  const bad = found(project("modules/a/x.ts", dynamic), "E2201");
  expect(bad).toHaveLength(1);
  expect(bad[0]?.fix).toBeUndefined();
  expect(found(project("modules/a/x.server.ts", dynamic), "E2201")).toHaveLength(0);
  const typeOnly = [
    `import type { Tokens } from "@keel/std-tokens/server"\nexport const n = 1\n`,
    `export type { Tokens } from "@keel/std-tokens/server"\n`,
  ];
  for (const source of typeOnly) {
    expect(found(project("modules/a/x.ts", source), "E2201"), source).toHaveLength(0);
    expect(found(project("modules/a/x.ts", source, "client"), "E2202"), source).toHaveLength(0);
  }
});

test("Each rule reads the file's own `import`, `export ... from` and `import()` declarations: a `require`, and a helper file that re-exports the entry, are not followed.", () => {
  const viaRequire = `import { createRequire } from "node:module"\nexport const c = createRequire(import.meta.url)("@keel/std-tokens/server")\n`;
  expect(found(project("modules/a/x.ts", viaRequire), "E2201")).toHaveLength(0);
  expect(found(project("modules/a/x.ts", IMPORT), "E2201")).toHaveLength(1);

  const helper = `export { tokens } from "@keel/std-tokens/server"\n`;
  const viaHelper = `import { tokens } from "../../lib/tokens.server.ts"\nexport const c = tokens\n`;
  const files: Files = [
    ...project("modules/a/x.server.ts", viaHelper, "static"),
    { path: "lib/tokens.server.ts", source: helper },
  ];
  expect(found(files, "E2202")).toHaveLength(0);
  const direct: Files = [...files, { path: "modules/a/y.server.ts", source: IMPORT }];
  const bad = found(direct, "E2202");
  expect(bad).toHaveLength(1);
  expect(bad[0]?.path).toBe("modules/a/y.server.ts");
});
