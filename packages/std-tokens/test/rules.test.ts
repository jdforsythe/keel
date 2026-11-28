// Seed 1337. E2201 and E2202 on aliased, namespace and re-export forms of the import, and not on type-only forms;
// their `explain` rows exist and are under 120 tokens.
import { check } from "@keel/check";
import { explain } from "@keel/check/explain";
import "@keel/std-tokens/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "a", deps: ["@keel/std-tokens"], capabilities: [], public: { exports: [], routes: [] } })
`;
const topo = (adapter: string) => `import { topology } from "@keel/server"
export default topology({ web: { modules: ["a"], adapter: "${adapter}" } })
`;
const FORMS = [
  'import { tokens as c } from "@keel/std-tokens/server"\nexport const x = c\n',
  'import * as k from "@keel/std-tokens/server"\nexport const x = k.tokens\n',
  'export { tokens } from "@keel/std-tokens/server"\n',
  'export * from "@keel/std-tokens/server"\n',
];
const TYPE_ONLY = [
  'import type { Tokens } from "@keel/std-tokens/server"\nexport type H = Tokens\n',
  'export type { Tokens } from "@keel/std-tokens/server"\n',
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
    fc.property(fc.constantFrom("@keel/std-tokens", "@keel/std-tokensx/server", "./server", "@keel/schema"), (from) => {
      const source = `import { x } from "${from}"\nexport const y = x\n`;
      expect(found("modules/a/x.ts", source, "client", "E2201")).toHaveLength(0);
      expect(found("modules/a/x.ts", source, "client", "E2202")).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("explain rows exist and are under 120 tokens", () => {
  for (const code of ["E2201", "E2202"]) {
    const text = explain(code);
    expect(text).toContain(code);
    expect(text).toContain("see: std.tokens");
    expect(text.split(/\s+/).length).toBeLessThan(120);
    expect(Math.ceil(text.length / 4)).toBeLessThan(120);
  }
});

test("E2201 and E2202 count a dynamic import() of the entry", () => {
  const source = 'export const f = () => import("@keel/std-tokens/server")\n';
  expect(found("modules/a/x.ts", source, "node", "E2201")).toHaveLength(1);
  expect(found("modules/a/x.server.ts", source, "node", "E2201")).toHaveLength(0);
  expect(found("modules/a/x.server.ts", source, "client", "E2202")).toHaveLength(1);
  const other = 'export const f = () => import("@keel/std-tokens")\n';
  expect(found("modules/a/x.ts", other, "node", "E2201")).toHaveLength(0);
});

test("a module whose id is test is not a test path; a test directory inside a module is", () => {
  const source = 'import { tokens } from "@keel/std-tokens/server"\nexport const c = tokens\n';
  expect(found("modules/test/x.ts", source, "node", "E2201")).toHaveLength(1);
  expect(found("modules/a/test/x.ts", source, "node", "E2201")).toHaveLength(0);
  expect(found("test/x.ts", source, "node", "E2201")).toHaveLength(0);
});
