// Spec: k.check, Conformance clause 1 (explain entry and fixture per code). Not cited yet: blocked (backlog 0138).
// 38 kernel Rules codes have no fixture that triggers them (runtime, cli, scaffold, harness codes and unimplemented
// rules). The coverage test below is `test.fails` until they do; when it turns red, make it `test` and quote the clause.
// Seed 1337 (no random inputs: the code set is read from spec/kernel/*.md and the public rule registry).
import { check, explain, rules } from "@keel/check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { specCodes } from "./spec-codes.ts";
import { approxTokens, registryCodes } from "./support.ts";

const isE = (c: string): boolean => /^E\d{4}$/.test(c);
const ALL: string[] = [...new Set([...specCodes(), ...registryCodes(rules()).filter(isE)])].sort();

test.fails("every E code in a Rules paragraph or the rule registry has an entry in CODE_FIXTURES", () => {
  expect(ALL.length).toBeGreaterThan(70);
  const missing = ALL.filter((c) => !Object.hasOwn(CODE_FIXTURES, c));
  expect(missing).toEqual([]);
});

for (const code of ALL) {
  test(`${code}: explain is at most 120 tokens and names the code`, () => {
    const text = explain(code);
    expect(typeof text).toBe("string");
    expect(text).toContain(code);
    expect(approxTokens(text)).toBeLessThanOrEqual(120);
  });

  const fx = Object.hasOwn(CODE_FIXTURES, code) ? CODE_FIXTURES[code] : undefined;
  if (fx !== undefined) {
    test(`${code}: its fixture triggers exactly that code`, () => {
      const found = [...new Set(check(fx.bad, fx.badOpts ?? fx.opts).diagnostics.map((d) => d.code))].sort();
      expect(found).toEqual([code]);
    });
  }
}
