// Spec: std.report, clause "With only `@keel/std-report` imported, `respond([tallyOf(id, keys)])` yields E1054; after `import('@keel/std-report/tools')` it prints the compact line."
// Seed 1337
// The formatter registry is process-wide and vitest isolates per file: this file must not import the tools entry at top.
import { respond } from "@keel/cli/testing";
import { tallyOf } from "@keel/std-report";
import fc from "fast-check";
import { expect, test } from "vitest";

const id = fc.stringMatching(/^[a-z][a-z.]{0,20}$/);
const keys = fc.array(fc.stringMatching(/^[a-z]{0,4}$/), { maxLength: 40 });
const TOOLS = "@keel/std-report/tools";
const first = (out: string): string => out.split("\n")[0] ?? "";

test("With only `@keel/std-report` imported, `respond([tallyOf(id, keys)])` yields E1054; after `import('@keel/std-report/tools')` it prints the compact line.", async () => {
  // seed 1337
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      const r = respond([tallyOf(i, ks)]);
      expect(r.stdout).toContain("E1054");
    }),
    { seed: 1337, numRuns: 25 },
  );
  await import(/* @vite-ignore */ TOOLS);
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      const t = tallyOf(i, ks);
      const r = respond([t]);
      expect(r.code).toBe(0);
      expect(r.stdout).not.toContain("E1054");
      const expected = t.rows.length === 0 ? `${i} 0` : [i, ...t.rows.map((x) => `${x.key}=${x.n}`)].join(" ");
      expect(first(r.stdout)).toBe(expected);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
