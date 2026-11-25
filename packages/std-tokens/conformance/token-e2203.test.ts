// std.tokens, Rules "E2203 an `output` (`outputSchemas`, k.privacy-reads) for which `schemaHolds` of `Digested` is `'yes'` (no fix)."
// Spec: std.tokens, clause "A page `loader` `output` and an API entry `output` holding `digest: Digested` are each one E2203; a store schema holding it is none."
// std.tokens, API "The token leaves once, as `reveal(token)` in the `*.server.ts` file that sends it (in `tx`, storage, a log or a throw: E1112). Its `digest` never leaves (E2203)."
// Seed: 1337.
// Not yet built: `test.skip` until `check()` reports E2203; remove the `.skip` in the build that adds it.
// Assumption: as in token-e1112.test.ts, `check()` imports nothing, so the rule registers by importing `@keel/std-tokens/tools`.
// Assumption: a finding is asserted by code, path and the line of the `output` expression (the position `outputSchemas` lists); the spec gives no column. No fix.
// Assumption: a store schema is `modules/a/row.schema.ts` holding `s.object({ id, digest: Digested })`, not used as an `output` anywhere.
import { check } from "@keel/check";
import "@keel/std-tokens/tools";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const MANIFEST = {
  path: "modules/a/module.ts",
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "a", deps: ["@keel/std-tokens"], capabilities: ["clock", "random"], public: { exports: [] } })\n`,
};
const HEAD = [
  `import { contract } from "@keel/router/contract"`,
  `import { loader } from "@keel/router"`,
  `import { s } from "@keel/schema"`,
  `import { Digested } from "@keel/std-tokens"`,
].join("\n");
const found = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E2203");
const field = fc.stringMatching(/^[a-z]{1,8}$/);

const api = (out: string): Files => [
  MANIFEST,
  {
    path: "modules/a/a.contract.ts",
    source: `${HEAD}\nexport const a = contract("a", { "a.get": { method: "GET", path: "/g", output: ${out} } })\n`,
  },
];
const page = (out: string): Files => [
  MANIFEST,
  {
    path: "modules/a/load.server.ts",
    source: `${HEAD}\nexport const load = loader(c, "a.page", { output: ${out} }, async () => null)\n`,
  },
];

test("A page `loader` `output` holding `digest: Digested` is one E2203", () => {
  fc.assert(
    fc.property(field, (f) => {
      const ds = found(page(`s.object({ ${f}: s.string(), digest: Digested })`));
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe("modules/a/load.server.ts");
      expect(ds[0]?.line).toBe(5);
      expect(ds[0]?.fix).toBeUndefined();
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("An API entry `output` holding `digest: Digested` is one E2203", () => {
  fc.assert(
    fc.property(field, (f) => {
      const ds = found(api(`s.object({ ${f}: s.string(), digest: Digested })`));
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe("modules/a/a.contract.ts");
      expect(ds[0]?.line).toBe(5);
      expect(ds[0]?.fix).toBeUndefined();
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("A store schema holding `Digested` is no E2203, and an `output` without it is none", () => {
  const store: Files = [
    MANIFEST,
    {
      path: "modules/a/row.schema.ts",
      source: `${HEAD}\nexport const Row = s.object({ id: s.string(), digest: Digested })\n`,
    },
  ];
  expect(found(store)).toHaveLength(0);
  expect(found(api("s.object({ id: s.string() })"))).toHaveLength(0);
  expect(found(page("s.object({ id: s.string() })"))).toHaveLength(0);
});

test("E2203 does not report an `output` whose `Digested` the reader cannot see: a factory call, a loader given `decl()`", () => {
  expect(found(api("s.object({ digest: make() })"))).toHaveLength(0);
  const viaDecl: Files = [
    MANIFEST,
    {
      path: "modules/a/load.server.ts",
      source: `${HEAD}\ndeclare function decl(x: unknown): unknown\nexport const load = loader(c, "a.page", decl({ output: s.object({ digest: Digested }) }), async () => null)\n`,
    },
  ];
  expect(found(viaDecl)).toHaveLength(0);
});

test("E2203 reports an `output` reaching `Digested` through a `const` of an imported `*.schema.ts`", () => {
  const files: Files = [
    MANIFEST,
    {
      path: "modules/a/row.schema.ts",
      source: `${HEAD}\nexport const Row = s.object({ id: s.string(), digest: Digested })\n`,
    },
    {
      path: "modules/a/a.contract.ts",
      source: `import { contract } from "@keel/router/contract"\nimport { Row } from "./row.schema.ts"\nexport const a = contract("a", { "a.get": { method: "GET", path: "/g", output: Row } })\n`,
    },
  ];
  expect(found(files)).toHaveLength(1);
});
