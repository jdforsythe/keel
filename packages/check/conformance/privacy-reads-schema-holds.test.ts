// Spec: k.privacy-reads, clause "With `names` `[{ from: '@keel/std-tokens', name: 'Digested' }]`, `schemaHolds` is `'yes'` for `s.object({ d: Digested })`, `D.optional()` with `D` an alias of it, `t.Digested` of a namespace import, and a `const` of an imported `*.schema.ts` holding one; `'unknown'` for `s.object({ d: make() })`; `'no'` for `s.object({ d: s.string() })` and for a schema imported from another package."
// k.privacy-reads, Readers "`schemaHolds(expr, input, names): 'yes' | 'unknown' | 'no'` reads the schema expression `expr` of `input.file` through `const`s, project imports and re-exports, object literal fields, spreads, array elements, call arguments, a call's receiver (`X.optional()` reads `X`) and both branches of `?:`. A part is listed when it is `{ from, name }` of `names` imported by name under any local name, or `<ns>.<name>` of a namespace import of `from`. The answer is `'yes'` when a part is listed; else `'unknown'` when a part is a call whose callee is not a member (a factory), a binding it cannot follow, a computed member, an object literal's getter, setter or method, or a literal binding that is not held (Held); else `'no'`. An import from a package `names` does not list is `'no'`: a package's schemas are its own (k.privacy E1111)."
// Seed: 1337.
// Not yet built: `test.skip` until `schemaHolds` is exported by `@keel/check`; remove the `.skip` in the build that adds it.
// Assumption: signature `schemaHolds(expr, input, names)`, `expr` a node of `input.ast`, `names` an array of `{ from, name }`; see privacy-reads-probe.ts.
// Assumption: the project is the files given to `check`, so `input.project` holds the imported `*.schema.ts`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { reader, run } from "./privacy-reads-probe.ts";
import type { Files } from "./privacy-reads-probe.ts";
import { SEED } from "./support.ts";

const PATH = "modules/a/x.ts";
const NAMES = [{ from: "@keel/std-tokens", name: "Digested" }];
const HEAD = [
  `import { s } from "@keel/schema"`,
  `import { Digested } from "@keel/std-tokens"`,
  `import { Digested as D } from "@keel/std-tokens"`,
  `import * as t from "@keel/std-tokens"`,
  `import { Row } from "./row.schema.ts"`,
  `import { Other } from "@keel/other"`,
  `import { Reexported } from "./index.schema.ts"`,
].join("\n");
const SCHEMA_FILES: Files = [
  {
    path: "modules/a/row.schema.ts",
    source: `import { s } from "@keel/schema"\nimport { Digested } from "@keel/std-tokens"\nexport const Row = s.object({ id: s.string(), digest: Digested })\n`,
  },
  { path: "modules/a/index.schema.ts", source: `export { Row as Reexported } from "./row.schema.ts"\n` },
];

function answer(body: string[], names = NAMES): unknown {
  const source = `${HEAD}\n${body.join("\n")}\n`;
  const holds = reader("schemaHolds");
  return run([{ path: PATH, source }, ...SCHEMA_FILES], PATH, (input, nodes) =>
    nodes.map((n) => holds(n, input, names)),
  );
}
const field = fc.stringMatching(/^[a-z]{1,8}$/);

test("`schemaHolds` is 'yes' for `s.object({ d: Digested })`, `D.optional()` with `D` an alias of it, `t.Digested` of a namespace import, and a `const` of an imported `*.schema.ts` holding one", () => {
  fc.assert(
    fc.property(field, (f) => {
      expect(
        answer([
          `probe(s.object({ ${f}: Digested }))`,
          `probe(D.optional())`,
          `probe(t.Digested)`,
          `probe(Row)`,
          `probe(Reexported)`,
        ]),
      ).toEqual(["yes", "yes", "yes", "yes", "yes"]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`schemaHolds` is 'unknown' for `s.object({ d: make() })`", () => {
  fc.assert(
    fc.property(field, (f) => {
      expect(answer([`probe(s.object({ ${f}: make() }))`])).toEqual(["unknown"]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`schemaHolds` is 'no' for `s.object({ d: s.string() })` and for a schema imported from another package", () => {
  fc.assert(
    fc.property(field, (f) => {
      expect(
        answer([`probe(s.object({ ${f}: s.string() }))`, `probe(s.object({ ${f}: Other }))`, `probe(Other)`]),
      ).toEqual(["no", "no", "no"]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`schemaHolds` reads through spreads, array elements, call arguments, a call's receiver and both branches of `?:`; 'yes' wins over 'unknown'", () => {
  const got = answer([
    `probe(s.object({ ...Row }))`,
    `probe(s.array([Digested]))`,
    `probe(s.union(s.string(), Digested))`,
    `probe(c ? s.string() : Digested)`,
    `probe(c ? Digested : s.string())`,
    `probe(s.object({ a: make(), d: Digested }))`,
  ]);
  expect(got).toEqual(["yes", "yes", "yes", "yes", "yes", "yes"]);
});

test("`schemaHolds` is 'unknown' for a factory call, a binding it cannot follow, a computed member, an object literal's getter or method, and a literal binding that is not held (Held)", () => {
  const got = answer([
    `const mutable = { d: s.string() }`,
    `mutable.d = Digested`,
    `const cm = { d: Digested }`,
    `probe(s.object({ d: cm[key] }))`,
    `probe(s.object({ get d() { return s.string() } }))`,
    `probe(s.object({ d() { return Digested } }))`,
    `probe(mutable)`,
    `probe(notBound)`,
    `probe(factory())`,
  ]);
  expect(got).toEqual(["unknown", "unknown", "unknown", "unknown", "unknown", "unknown"]);
});
