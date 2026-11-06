// Seed 1337
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { one, SEED } from "./support.ts";

const ident = fc.stringMatching(/^[a-z]{3,8}$/);
const codes = (src: string, path: string) => check(one(src, path), {}).diagnostics.map((d) => d.code);

test("E1752: a file with more than one export is reported", () => {
  fc.assert(
    fc.property(ident, ident, (a, b) => {
      fc.pre(a !== b);
      expect(codes(`export const ${a} = 1;\nexport const ${b} = 2;\n`, `${a}.ts`)).toContain("E1752");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1752: a filename not equal to its export is reported", () => {
  fc.assert(
    fc.property(ident, ident, (file, name) => {
      fc.pre(file !== name);
      expect(codes(`export const ${name} = 1;\n`, `${file}.ts`)).toContain("E1752");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1752: one export whose name equals the filename reports no E1752", () => {
  fc.assert(
    fc.property(ident, (name) => {
      expect(codes(`export const ${name} = 1;\n`, `${name}.ts`)).not.toContain("E1752");
    }),
    { seed: SEED, numRuns: 20 },
  );
});
