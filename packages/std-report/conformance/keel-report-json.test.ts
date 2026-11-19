// Spec: std.report, clause "`keel report --format=json` prints each tally as one line equal to the record and a last line with `kind: \"summary\"`, `name: \"report\"` and `counts: { tallies }`."
// Seed 1337
import { run } from "@keel/cli";
import { tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const keys = fc.array(fc.stringMatching(/^[a-z]{0,4}$/), { maxLength: 20 });
const ids = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z.]{0,10}$/), { maxLength: 4 });
const parse = (out: string): unknown[] =>
  out
    .split("\n")
    .filter((l) => l !== "")
    .map((l): unknown => JSON.parse(l));

test('`keel report --format=json` prints each tally as one line equal to the record and a last line with `kind: "summary"`, `name: "report"` and `counts: { tallies }`.', async () => {
  await fc.assert(
    fc.asyncProperty(ids, fc.array(keys, { minLength: 4, maxLength: 4 }), async (names, ks) => {
      const tallies = names.map((n, i) => tallyOf(n, ks[i] ?? []));
      const sections = Object.fromEntries(tallies.map((t) => [t.id, { doc: "tally", value: t }]));
      const doc = { live: true, graph: { nodes: [], edges: [] }, stores: {}, ids: {}, a11y: {}, routes: {}, sections };
      const r = await run(["report", "--format=json"], {
        cwd: "/work/app",
        files: [],
        fetch: (): Promise<Response> => Promise.resolve(new Response(JSON.stringify(doc), { status: 200 })),
      });
      expect(r.code).toBe(0);
      const recs = parse(r.stdout);
      const sorted = [...tallies].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
      expect(recs.slice(0, -1)).toEqual(sorted);
      expect(recs.at(-1)).toMatchObject({ kind: "summary", name: "report", counts: { tallies: tallies.length } });
    }),
    { seed: 1337, numRuns: 25 },
  );
});
