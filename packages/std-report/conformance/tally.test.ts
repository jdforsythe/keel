// Spec: std.report, clause "For generated key lists, `tallyOf` returns a record that parses with `Tally`. Its `n` values sum to the number of non-empty keys, and its rows follow the stated order."
// Seed 1337
import { Tally, tallyOf } from "@keel/std-report";
import fc from "fast-check";
import { expect, test } from "vitest";

const id = fc.stringMatching(/^[a-z][a-z.]{0,20}$/);
const keys = fc.array(fc.stringMatching(/^[a-z]{0,4}$/), { maxLength: 40 });

test("For generated key lists, `tallyOf` returns a record that parses with `Tally`. Its `n` values sum to the number of non-empty keys, and its rows follow the stated order.", () => {
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      const t = tallyOf(i, ks);
      expect(Tally.parse(t).ok).toBe(true);
      expect(t.kind).toBe("report.tally");
      expect(t.id).toBe(i);
      expect(t.rows.reduce((sum, r) => sum + r.n, 0)).toBe(ks.filter((k) => k !== "").length);
      expect(new Set(t.rows.map((r) => r.key)).size).toBe(t.rows.length);
      for (const r of t.rows) expect(r.n).toBe(ks.filter((k) => k === r.key).length);
      for (let j = 1; j < t.rows.length; j++) {
        const p = t.rows[j - 1];
        const c = t.rows[j];
        if (p === undefined || c === undefined) continue;
        expect(p.n > c.n || (p.n === c.n && p.key < c.key)).toBe(true);
      }
    }),
    { seed: 1337, numRuns: 100 },
  );
});
