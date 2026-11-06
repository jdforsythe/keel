// Clauses: "After rename, no import, href() call, uses: entry, or element id references the old name."
//          "rename A B then rename B A restores a byte-identical tree."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type Files,
  RUNS,
  SEED,
  apply,
  distinctPair,
  lowerName,
  pascalName,
  snap,
  withOrders,
  word,
} from "./fixtures.ts";

type Kind = "component" | "store" | "route";
// seed 1337
const cases: {
  kind: Kind;
  names: fc.Arbitrary<readonly [string, string]>;
  id: (n: string) => Record<string, unknown>;
  token: (n: string) => string;
  bare: (n: string) => string;
}[] = [
  {
    kind: "component",
    names: distinctPair(pascalName),
    id: (n) => ({ id: `orders/${n}` }),
    token: (n) => n,
    bare: (n) => n,
  },
  {
    kind: "store",
    names: distinctPair(lowerName),
    id: (n) => ({ id: `orders.${n}` }),
    token: (n) => `orders.${n}`,
    bare: (n) => n,
  },
  {
    kind: "route",
    names: distinctPair(lowerName),
    id: (n) => ({ id: `orders.${n}`, path: `/zz/${n}/:id` }),
    token: (n) => `orders.${n}`,
    bare: (n) => n,
  },
];

function setup(kind: Kind, name: string, spec: (typeof cases)[number]): Files {
  // component/store/route named `name` created in the standard project, plus a page that references it
  let files = withOrders();
  files = apply(kind, spec.id(name), files).files;
  const page = "modules/orders/ZqUse.tsx";
  const t = spec.token(name);
  files.set(
    page,
    `// refs\nimport X from './${name}.tsx'\nconst a = href('${t}')\nconst u = { uses: [${name}] }\nconst el = 'id="${name}-1"'\n`,
  );
  return files;
}

describe("rename", () => {
  for (const spec of cases) {
    it(`after rename of a ${spec.kind}, the old name appears nowhere and the new name appears in every place the old did`, () => {
      fc.assert(
        fc.property(spec.names, ([a, b]) => {
          const before = setup(spec.kind, a, spec);
          const from = spec.kind === "component" ? a : spec.token(a);
          const to = spec.kind === "component" ? b : spec.token(b);
          const after = apply("rename", { kind: spec.kind, from, to }, before).files;
          for (const re of [word(a), word(spec.token(a))]) {
            for (const [p, c] of after) {
              expect(re.test(p), `path ${p}`).toBe(false);
              expect(re.test(c), `content ${p}`).toBe(false);
            }
          }
          for (const [p, c] of before) {
            const had = word(a).test(c) || word(spec.token(a)).test(c);
            const p2 = p.split(a).join(b);
            if (had) {
              const c2 = after.get(p2);
              expect(c2, `moved ${p} -> ${p2}`).toBeDefined();
              expect(c2 !== undefined && (word(b).test(c2) || word(spec.token(b)).test(c2)), p2).toBe(true);
            }
          }
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });

    it(`rename A B then rename B A restores a byte-identical tree (${spec.kind})`, () => {
      fc.assert(
        fc.property(spec.names, ([a, b]) => {
          const before = setup(spec.kind, a, spec);
          const from = spec.kind === "component" ? a : spec.token(a);
          const to = spec.kind === "component" ? b : spec.token(b);
          const mid = apply("rename", { kind: spec.kind, from, to }, before).files;
          const back = apply("rename", { kind: spec.kind, from: to, to: from }, mid).files;
          expect(snap(back)).toBe(snap(before));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
  }
});
