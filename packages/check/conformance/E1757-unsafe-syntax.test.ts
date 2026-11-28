// Seed 1337
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const ident = fc.stringMatching(/^[a-z]{3,8}$/);
const codes = (src: string, path = "src/a.ts") =>
  check(one(src, path), { types: false }).diagnostics.map((d) => d.code);

const SUPPRESS = `@ts-${"ignore"}`;
const BAD = (n: string): string[] => [
  `declare const ${n}: unknown;\nexport const a = ${n} as number;\n`,
  `declare const ${n}: { a?: number };\nexport const a = ${n}.a!;\n`,
  `export const a: any = 1;\n`,
  `// ${SUPPRESS}\nexport const a: number = "x";\n`,
];

test("E1757: a cast, non-null assertion, any, or ts-suppression is reported", () => {
  fc.assert(
    fc.property(ident, (n) => {
      for (const src of BAD(n)) expect(codes(src)).toContain("E1757");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1757: the same source in a file under unsafe/, outside any `unsafe(` call, is reported too", () => {
  fc.assert(
    fc.property(ident, (n) => {
      for (const src of BAD(n)) expect(codes(src, "src/unsafe/a.ts")).toContain("E1757");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1757: as const and satisfies are not casts", () => {
  expect(codes(`export const a = [1] as const;\nexport const b = { x: 1 } satisfies { x: number };\n`)).not.toContain(
    "E1757",
  );
});
