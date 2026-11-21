// Spec: k.evidence, Conformance "No bundle file of a fixture whose stores and tests hold generated `.pii()` values contains any of them."
// Spec: k.evidence, Command "No file holds an app value: records carry ids, codes, paths, counts and hashes."
// Seed: 1337. The 100 cases are drawn with `fc.sample` (seed 1337) and written into one fixture project, each as a
// generated schema with `.pii()` nodes (leaf, nested object, array item), a store holding generated values and a test
// holding them; `keel evidence` runs once, then a 100-run property checks every case's values against every bundle file.
// Values are lowercase tokens behind the prefix `Zq7x`, long enough that no hash, count or path of the bundle holds one.
import { rmSync } from "node:fs";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, TEST_KEY_PEM, fixtureTree, project, readTree, removeDir, writeBundle } from "./evidence-fixture.ts";

const SLOW = 600_000;
const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
const FIELDS = ["name", "email", "phone", "street", "note", "acct", "city", "ip"] as const;
const SHAPES = ["leaf", "nested", "array"] as const;

type Field = {
  key: (typeof FIELDS)[number];
  cls: (typeof CLASSES)[number];
  shape: (typeof SHAPES)[number];
  value: string;
};
const token = fc
  .string({ unit: fc.constantFrom(..."abcdefghjkmnpqrstuvwxyz23456789"), minLength: 14, maxLength: 22 })
  .map((t) => `Zq7x${t}`);
const field = fc.record({
  key: fc.constantFrom(...FIELDS),
  cls: fc.constantFrom(...CLASSES),
  shape: fc.constantFrom(...SHAPES),
  value: token,
});
const fieldsArb = fc.uniqueArray(field, { minLength: 1, maxLength: 4, selector: (f) => f.key });

const schemaExpr = (f: Field): string => {
  const leaf = `s.string().pii("${f.cls}")`;
  if (f.shape === "leaf") return leaf;
  return f.shape === "nested" ? `s.object({ inner: ${leaf} })` : `s.array(${leaf})`;
};
const valueExpr = (f: Field): string =>
  f.shape === "leaf" ? `"${f.value}"` : f.shape === "nested" ? `{ inner: "${f.value}" }` : `["${f.value}"]`;

const caseFiles = (fields: readonly Field[], i: number): Record<string, string> => {
  const name = `Case${i}`;
  const object = (expr: (f: Field) => string): string => `{ ${fields.map((f) => `${f.key}: ${expr(f)}`).join(", ")} }`;
  return {
    [`modules/a/${name}.schema.ts`]: `import { s } from "@keel/schema";\n\nexport const ${name} = s.object(${object(schemaExpr)});\n`,
    [`modules/a/${name}Store.ts`]: `import { store } from "@keel/store";\nimport { ${name} } from "./${name}.schema.ts";\n\nexport const ${name}Store = store(${name}, ${object(valueExpr)}, { id: "a.case${i}" });\n`,
    [`packages/m/test/case${i}.test.ts`]: `import { expect, it } from "vitest";\n\nit("holds case ${i}", () => {\n  expect([${fields.map((f) => `"${f.value}"`).join(", ")}]).toHaveLength(${fields.length});\n});\n`,
  };
};

const cases: Field[][] = fc.sample(fieldsArb, { seed: SEED, numRuns: 100 });
let dir = "";
let base = "";
let bundle = new Map<string, Buffer>();

beforeAll(() => {
  const extra = Object.assign({}, ...cases.map((c, i) => caseFiles(c, i)));
  dir = project(fixtureTree({ extra }));
  const written = writeBundle(dir, TEST_KEY_PEM);
  base = written.base;
  bundle = readTree(written.out);
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(base);
});

describe("k.evidence: no personal values in the bundle", () => {
  test(
    "No bundle file of a fixture whose stores and tests hold generated `.pii()` values contains any of them",
    () => {
      expect(cases).toHaveLength(100);
      expect(bundle.size).toBe(8);
      const texts = [...bundle.values()].map((b) => b.toString("utf8"));
      fc.assert(
        fc.property(fc.nat({ max: cases.length - 1 }), (i) => {
          for (const f of cases[i] ?? []) for (const t of texts) expect(t).not.toContain(f.value);
        }),
        { seed: SEED, numRuns: 100 },
      );
    },
    SLOW,
  );

  test(
    "the bundle is not empty of the cases: `pii.json` names each generated schema export",
    () => {
      const pii = bundle.get("pii.json")?.toString("utf8") ?? "";
      for (let i = 0; i < cases.length; i++) expect(pii).toContain(`Case${i}`);
    },
    SLOW,
  );
});
