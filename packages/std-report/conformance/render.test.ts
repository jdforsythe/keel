// Spec: std.report, clause "`respond([tallyOf(id, keys)], { format: 'compact' })` (`@keel/cli/testing`) prints the compact line as its first line, with exit code 0."
// Spec: std.report, clause "`pretty` prints the `id` line and one line per row. The keys start in one column and the counts end in one column."
// Spec: std.report, clause "`json` prints the record as one line that parses back to a value equal to the record."
// Spec: std.report, clause "Compact and json output contain no ANSI escapes or carriage returns."
// Seed 1337
import { respond } from "@keel/cli/testing";
import { tallyOf } from "@keel/std-report";
import fc from "fast-check";
import { expect, test } from "vitest";

const id = fc.stringMatching(/^[a-z][a-z.]{0,20}$/);
const keys = fc.array(fc.stringMatching(/^[a-z]{0,4}$/), { maxLength: 40 });
const run = { seed: 1337, numRuns: 100 };
const lines = (out: string): string[] => {
  const ls = out.split("\n");
  if (ls[ls.length - 1] === "") ls.pop();
  return ls;
};

test("`respond([tallyOf(id, keys)], { format: 'compact' })` (`@keel/cli/testing`) prints the compact line as its first line, with exit code 0.", () => {
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      const t = tallyOf(i, ks);
      const r = respond([t], { format: "compact" });
      expect(r.code).toBe(0);
      const expected = t.rows.length === 0 ? `${i} 0` : [i, ...t.rows.map((x) => `${x.key}=${x.n}`)].join(" ");
      expect(lines(r.stdout)[0]).toBe(expected);
    }),
    run,
  );
  expect(
    lines(respond([tallyOf("orders.status", ["paid", "open", "paid", "paid", ""])], { format: "compact" }).stdout)[0],
  ).toBe("orders.status paid=3 open=1");
});

test("`pretty` prints the `id` line and one line per row. The keys start in one column and the counts end in one column.", () => {
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      const t = tallyOf(i, ks);
      const r = respond([t], { format: "pretty" });
      expect(r.code).toBe(0);
      const ls = lines(r.stdout);
      expect(ls.length).toBe(1 + t.rows.length);
      expect(ls[0]).toBe(i);
      const kw = Math.max(0, ...t.rows.map((x) => x.key.length));
      const nw = Math.max(0, ...t.rows.map((x) => String(x.n).length));
      t.rows.forEach((row, j) => {
        expect(ls[j + 1]).toBe(`${row.key.padEnd(kw)}  ${String(row.n).padStart(nw)}`);
      });
    }),
    run,
  );
});

test("`json` prints the record as one line that parses back to a value equal to the record.", () => {
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      const t = tallyOf(i, ks);
      const r = respond([t], { format: "json" });
      expect(r.code).toBe(0);
      const ls = lines(r.stdout);
      expect(ls.length).toBe(1);
      expect(JSON.parse(ls[0] ?? "")).toEqual(t);
    }),
    run,
  );
});

test("Compact and json output contain no ANSI escapes or carriage returns.", () => {
  fc.assert(
    fc.property(id, keys, (i, ks) => {
      for (const format of ["compact", "json"] as const) {
        const out = respond([tallyOf(i, ks)], { format }).stdout;
        expect(out).not.toContain("\u001b");
        expect(out).not.toContain("\r");
      }
    }),
    run,
  );
});
