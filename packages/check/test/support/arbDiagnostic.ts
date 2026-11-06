import fc from "fast-check";
import type { Diagnostic } from "../../src/index.ts";

const CODES = ["E1001", "E1042", "E1501", "E1805", "W2001", "I2002"];
const PATHS = ["src/a.tsx", "src/b.ts", "src/cart/add.tsx", "z.ts"];

/** A generated diagnostic: small code/path vocabularies so groups and duplicates occur. */
export const arbDiagnostic: fc.Arbitrary<Diagnostic> = fc
  .record({
    code: fc.constantFrom(...CODES),
    path: fc.constantFrom(...PATHS),
    line: fc.integer({ min: 1, max: 40 }),
    col: fc.integer({ min: 1, max: 9 }),
    message: fc.constantFrom("first message", "second message", "a third, longer message"),
    fix: fc.option(fc.constantFrom("--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new", "-a\n+b"), { nil: undefined }),
  })
  .map(({ fix, ...d }) => (fix === undefined ? { kind: "diag", ...d } : { kind: "diag", ...d, fix }));

/** Identity of a diagnostic for dedupe accounting. */
export const keyOf = (d: Diagnostic): string =>
  JSON.stringify([d.code, d.path, d.line, d.col, d.message, d.fix ?? null]);
