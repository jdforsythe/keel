// Spec: k.schema Rules, "E1106 `s.format` in app code (format types are stdlib's)." and Conformance "`s.format` in an app file is E1106." (rfc:0079)
// Seed 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const ident = fc.stringMatching(/^[a-z]{3,8}$/);
const BAD = (name: string): string =>
  `import { s } from '@keel/schema'\nexport const Even = s.format('${name}', s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } })\n`;
const CLEAN = `import { s } from '@keel/schema'\nexport const Count = s.int({ min: 0 })\n`;
const codes = (src: string, path: string): string[] =>
  check(one(src, path), { types: false }).diagnostics.map((d) => d.code);

test("E1106: `s.format` in an app file reports E1106", () => {
  fc.assert(
    fc.property(ident, (name) => {
      expect(codes(BAD(name), "modules/app/Even.schema.ts").filter((c) => c === "E1106")).toEqual(["E1106"]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1106: `s.format` through a renamed `s` import in an app file reports E1106", () => {
  const src = BAD("even")
    .replace("{ s }", "{ s as schema }")
    .replace("s.format", "schema.format")
    .replace(/s\.int/g, "schema.int");
  expect(codes(src, "modules/app/Even.schema.ts")).toContain("E1106");
});

test("E1106: an app file that declares schemas without `s.format` reports no E1106", () => {
  expect(codes(CLEAN, "modules/app/Count.schema.ts")).not.toContain("E1106");
});

test("E1106: a triggering fixture reports exactly that code with no fix", () => {
  const ds = check(one(BAD("even"), "modules/app/Even.schema.ts"), { types: false }).diagnostics.filter(
    (d) => d.code === "E1106",
  );
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
});
