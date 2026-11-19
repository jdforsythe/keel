// Spec: std.credentials, Rules "E2201 `@keel/std-credentials/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside (no fix)"
// Spec: std.credentials, Rules "E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix)."
// Spec: std.credentials, Conformance "E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `credentials`."
// Spec: std.credentials, Conformance "`import('@keel/std-credentials/server')` outside a `*.server.ts` file is E2201; `import type` from it is not."
// Spec: std.credentials, Conformance "A `*.server.ts` action passing the value of `credentials(ctx).hash(input.password)` to `tx` has no E1112 or E1105."
// Spec: std.credentials, Rules "Each rule reads the file's own `import`, `export ... from` and `import()` declarations: a `require`, and a helper file that re-exports the entry, are not followed."
// Seed: 1337.
// Assumption: as for std.db E2151, `check()` imports nothing, so the rules register by importing `@keel/std-credentials/tools`.
// Assumption: a diagnostic is `{ code, path, line, col, message, fix?, see? }` (k.check), so "naming the deployable and its adapter" is read from `message`; there is no `data` field.
// Assumption: "tests aside" is a `*.test.ts` file; the clean twin of the E2202 case is the same file in a `node` deployable.
import { check } from "@keel/check";
import { capabilities } from "@keel/ctx";
import "@keel/std-credentials/server";
import "@keel/std-credentials/tools";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "a", deps: ["@keel/std-credentials"], capabilities: ["clock", "random"], public: { exports: [], routes: [] } })
`;
const topo = (adapter: string, name = "web") => `import { topology } from "@keel/server"
export default topology({ ${name}: { modules: ["a"], adapter: "${adapter}" } })
`;
const IMPORT = `import { credentials } from "@keel/std-credentials/server"\nexport const c = credentials\n`;
const project = (path: string, source: string, adapter = "node", name = "web"): Files => [
  { path: "modules/a/module.ts", source: manifest },
  { path, source },
  { path: "topology.ts", source: topo(adapter, name) },
];
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const word = fc.stringMatching(/^[a-z]{3,10}$/);

test("E2201 `@keel/std-credentials/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside (no fix)", () => {
  fc.assert(
    fc.property(word, (name) => {
      const bad = found(project(`modules/a/${name}.ts`, IMPORT), "E2201");
      expect(bad).toHaveLength(1);
      expect(bad[0]?.path).toBe(`modules/a/${name}.ts`);
      expect(bad[0]?.fix).toBeUndefined();
      expect(found(project(`modules/a/${name}.server.ts`, IMPORT), "E2201")).toHaveLength(0);
      expect(found(project(`modules/a/${name}.test.ts`, IMPORT), "E2201")).toHaveLength(0);
      const client = `import { Hashed } from "@keel/std-credentials"\nexport const h = Hashed\n`;
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

test("E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `credentials`.", () => {
  expect(found(project("modules/a/x.ts", IMPORT), "E2201")).toHaveLength(1);
  expect(found(project("modules/a/x.server.ts", IMPORT), "E2201")).toHaveLength(0);
  expect(found(project("modules/a/x.server.ts", IMPORT, "client"), "E2202")).toHaveLength(1);
  expect(found(project("modules/a/x.server.ts", IMPORT, "static"), "E2202")).toHaveLength(1);
  expect(found(project("modules/a/x.server.ts", IMPORT, "node"), "E2202")).toHaveLength(0);
  expect(capabilities()).toContain("credentials");
  expect(capabilities().filter((n) => n === "credentials")).toHaveLength(1);
});

test("A `*.server.ts` action passing the value of `credentials(ctx).hash(input.password)` to `tx` has no E1112 or E1105.", () => {
  const source = [
    `import { credentials } from "@keel/std-credentials/server"`,
    `import { tx } from "@keel/store"`,
    "export async function register(ctx, t, input) {",
    "  const hashed = await credentials(ctx).hash(input.password)",
    "  if (!hashed.ok) return hashed",
    "  tx(t, { password: hashed.value })",
    "  return hashed",
    "}",
    "",
  ].join("\n");
  const files = project("modules/a/register.server.ts", source);
  expect(found(files, "E1112")).toHaveLength(0);
  expect(found(files, "E1105")).toHaveLength(0);
  expect(found(files, "E2201")).toHaveLength(0);
});

test("`import('@keel/std-credentials/server')` outside a `*.server.ts` file is E2201; `import type` from it is not.", () => {
  const dynamic = `export const f = () => import("@keel/std-credentials/server")\n`;
  const bad = found(project("modules/a/x.ts", dynamic), "E2201");
  expect(bad).toHaveLength(1);
  expect(bad[0]?.fix).toBeUndefined();
  expect(found(project("modules/a/x.server.ts", dynamic), "E2201")).toHaveLength(0);
  const typeOnly = [
    `import type { Hasher } from "@keel/std-credentials/server"\nexport const n = 1\n`,
    `export type { Hasher } from "@keel/std-credentials/server"\n`,
  ];
  for (const source of typeOnly) {
    expect(found(project("modules/a/x.ts", source), "E2201"), source).toHaveLength(0);
    expect(found(project("modules/a/x.ts", source, "client"), "E2202"), source).toHaveLength(0);
  }
});

test("Each rule reads the file's own `import`, `export ... from` and `import()` declarations: a `require`, and a helper file that re-exports the entry, are not followed.", () => {
  const viaRequire = `import { createRequire } from "node:module"\nexport const c = createRequire(import.meta.url)("@keel/std-credentials/server")\n`;
  expect(found(project("modules/a/x.ts", viaRequire), "E2201")).toHaveLength(0);
  expect(found(project("modules/a/x.ts", IMPORT), "E2201")).toHaveLength(1);

  const helper = `export { credentials } from "@keel/std-credentials/server"\n`;
  const viaHelper = `import { credentials } from "../../lib/creds.server.ts"\nexport const c = credentials\n`;
  const files: Files = [
    ...project("modules/a/x.server.ts", viaHelper, "static"),
    { path: "lib/creds.server.ts", source: helper },
  ];
  expect(found(files, "E2202")).toHaveLength(0);
  const direct: Files = [...files, { path: "modules/a/y.server.ts", source: IMPORT }];
  const bad = found(direct, "E2202");
  expect(bad).toHaveLength(1);
  expect(bad[0]?.path).toBe("modules/a/y.server.ts");
});
