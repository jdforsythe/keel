// Spec: k.formats, clause "In a folder whose `package.json` is that library's and whose root `module.ts` is that manifest, `keel check` reports no E1106 for `EVEN` in `src/Even.schema.ts`, in `src/Even.test.ts` or in `test/Even.test.ts`, and one E1106, at `modules/shop/Even.schema.ts`, for `EVEN` there."
// Seed: 1337 (no generated input). Binary runs: 1, the folder shared by the cases (the real `keel` binary; no std package is imported).
// Cases marked `Pending (rfc:0237)` fail until the build lands; the builder un-skips by changing each `it.skip` to `it`.
// ASSUMPTION (spec silent): `modules/shop/` holds only `Even.schema.ts`; no manifest is given for it, as the clause names none.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SLOW, cleanup, diags, keel, manifestOf, materialize, type Tree } from "./library-support.ts";

const EVEN =
  "import { s } from '@keel/schema'\nexport const Even = s.format('units.even', s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } })\n";
const tree: Tree = {
  "package.json": JSON.stringify({ name: "@acme/units", version: "1.0.0", type: "module", keel: "library" }),
  "module.ts": manifestOf("units", [], ["Even"]),
  "src/Even.schema.ts": EVEN,
  "src/Even.test.ts": EVEN,
  "test/Even.test.ts": EVEN,
  "modules/shop/Even.schema.ts": EVEN,
};

let dir = "";
let paths: string[] = [];
beforeAll(() => {
  dir = materialize(tree);
  paths = diags(keel(dir, ["check"]), "E1106").flatMap((r) => (typeof r.path === "string" ? [r.path] : []));
}, SLOW);
afterAll(() => cleanup(dir));

describe("E1106 in a library's own folder", () => {
  // Pending (rfc:0237)
  it.skip("`keel check` in the library's folder reports no E1106 for `EVEN` in `src/Even.schema.ts`", () => {
    expect(paths).not.toContain("src/Even.schema.ts");
  });

  // Pending (rfc:0237)
  it.skip("`keel check` in the library's folder reports no E1106 for `EVEN` in `src/Even.test.ts`", () => {
    expect(paths).not.toContain("src/Even.test.ts");
  });

  it("`keel check` in the library's folder reports no E1106 for `EVEN` in `test/Even.test.ts`", () => {
    expect(paths).not.toContain("test/Even.test.ts");
  });

  it("`keel check` in the library's folder reports one E1106, at `modules/shop/Even.schema.ts`", () => {
    expect(paths.filter((p) => p === "modules/shop/Even.schema.ts")).toEqual(["modules/shop/Even.schema.ts"]);
  });

  // Pending (rfc:0237)
  it.skip("`keel check` in the library's folder reports no E1106 but the one at `modules/shop/Even.schema.ts`", () => {
    expect(paths).toEqual(["modules/shop/Even.schema.ts"]);
  });
});
