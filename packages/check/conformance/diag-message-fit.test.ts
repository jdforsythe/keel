// Spec: k.check, Conformance "For each code `reportedCodes()` lists, every diagnostic of that code its fixture reports has a message of at most 89 UTF-16 code units that does not end in `...`."
// Seed n/a: the fixtures are the table in fixtures-by-code.ts (`bad` and `clean`, each with its options); no generated input.
// ASSUMPTION: "its fixture" is the code's entry in fixtures-by-code.ts; the diagnostics of that code are read from `check(bad, options)`. A code `reportedCodes()` lists with no entry there has no fixture and is listed by the first test.
import { check, reportedCodes } from "@keel/check";
import { describe, expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";

const codes = reportedCodes();

describe("k.check: a diagnostic's message fits", () => {
  test("every code `reportedCodes()` lists has a fixture in the by-code table", () => {
    expect(codes.filter((c) => CODE_FIXTURES[c] === undefined)).toEqual([]);
  });

  for (const code of codes) {
    test(`${code}: every diagnostic of that code its fixture reports has a message of at most 89 UTF-16 code units that does not end in \`...\``, () => {
      const fx = CODE_FIXTURES[code];
      if (fx === undefined) throw new Error(`no fixture for ${code}`);
      const found = check(fx.bad, fx.badOpts ?? fx.opts ?? {}).diagnostics.filter((d) => d.code === code);
      expect(found.length, `${code} fixture reports it`).toBeGreaterThan(0);
      for (const d of found) {
        expect(d.message.length, d.message).toBeLessThanOrEqual(89);
        expect(d.message.endsWith("..."), d.message).toBe(false);
      }
    }, 60_000);
  }
});
