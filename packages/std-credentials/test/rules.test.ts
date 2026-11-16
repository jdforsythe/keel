// Seed 1337. E2201 and E2202 on aliased, namespace and re-export forms of the import, and not on type-only forms;
// their `explain` rows exist and are under 120 tokens.
import { check, explain } from "@keel/check";
import "@keel/std-credentials/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "a", deps: ["@keel/std-credentials"], capabilities: [], public: { exports: [], routes: [] } })
`;
const topo = (adapter: string) => `import { topology } from "@keel/server"
export default topology({ web: { modules: ["a"], adapter: "${adapter}" } })
`;
const FORMS = [
  'import { credentials as c } from "@keel/std-credentials/server"\nexport const x = c\n',
  'import * as k from "@keel/std-credentials/server"\nexport const x = k.credentials\n',
  'export { credentials } from "@keel/std-credentials/server"\n',
  'export * from "@keel/std-credentials/server"\n',
];
const TYPE_ONLY = [
  'import type { Hasher } from "@keel/std-credentials/server"\nexport type H = Hasher\n',
  'export type { Hasher } from "@keel/std-credentials/server"\n',
];
const found = (path: string, source: string, adapter: string, code: string) =>
  check(
    [
      { path: "modules/a/module.ts", source: manifest },
      { path, source },
      { path: "topology.ts", source: topo(adapter) },
    ],
    { types: false },
  ).diagnostics.filter((d) => d.code === code && d.path === path);

test.each(FORMS)("E2201 on each form outside a *.server.ts file: %s", (form) => {
  expect(found("modules/a/x.ts", form, "node", "E2201")).toHaveLength(1);
  expect(found("modules/a/x.server.ts", form, "node", "E2201")).toHaveLength(0);
  expect(found("modules/a/x.test.ts", form, "node", "E2201")).toHaveLength(0);
});

test.each(FORMS)("E2202 on each form in a module a client or static deployable serves: %s", (form) => {
  for (const adapter of ["client", "static"]) {
    const d = found("modules/a/x.server.ts", form, adapter, "E2202");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toContain(adapter);
  }
  expect(found("modules/a/x.server.ts", form, "node", "E2202")).toHaveLength(0);
});

test.each(TYPE_ONLY)("a type-only import or re-export is not reported: %s", (form) => {
  expect(found("modules/a/x.ts", form, "node", "E2201")).toHaveLength(0);
  expect(found("modules/a/x.ts", form, "client", "E2202")).toHaveLength(0);
});

test("other sources and other packages' entries are not reported", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("@keel/std-credentials", "@keel/std-credentialsx/server", "./server", "@keel/schema"),
      (from) => {
        const source = `import { x } from "${from}"\nexport const y = x\n`;
        expect(found("modules/a/x.ts", source, "client", "E2201")).toHaveLength(0);
        expect(found("modules/a/x.ts", source, "client", "E2202")).toHaveLength(0);
      },
    ),
    { seed: SEED, numRuns: 20 },
  );
});

test("explain rows exist and are under 120 tokens", () => {
  for (const code of ["E2201", "E2202"]) {
    const text = explain(code);
    expect(text).toContain(code);
    expect(text).toContain("see: std.credentials");
    expect(text.split(/\s+/).length).toBeLessThan(120);
    expect(Math.ceil(text.length / 4)).toBeLessThan(120);
  }
});
