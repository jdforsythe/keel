// Spec: std.report, clause "`keel report http://h/t?x=1` makes one request, to it: a `Tally` body prints its compact line and `ok report 1 tallies`; an array of tallies `b`, `a` prints `b`, `a`, `ok report 2 tallies`; `[]` prints `ok report 0 tallies`; each exits 0."
// Seed 1337
import { run } from "@keel/cli";
import { tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const keys = fc.array(fc.stringMatching(/^[a-z]{0,4}$/), { maxLength: 20 });
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");
const compact = (t: ReturnType<typeof tallyOf>): string =>
  t.rows.length === 0 ? `${t.id} 0` : [t.id, ...t.rows.map((x) => `${x.key}=${x.n}`)].join(" ");
const URL_ = "http://h/t?x=1";
const serve = (body: unknown, seen: string[]) => ({
  cwd: "/work/app",
  files: [],
  fetch: (url: string): Promise<Response> => {
    seen.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  },
});

test("`keel report http://h/t?x=1` makes one request, to it: a `Tally` body prints its compact line and `ok report 1 tallies`", async () => {
  const t = tallyOf("a", ["x", "y", "x"]);
  const seen: string[] = [];
  const r = await run(["report", URL_, "--format=compact"], serve(t, seen));
  expect(seen).toEqual([URL_]);
  expect(r.code).toBe(0);
  expect(lines(r.stdout)).toEqual([compact(t), "ok report 1 tallies"]);
});

test("`keel report http://h/t?x=1`: an array of tallies `b`, `a` prints `b`, `a`, `ok report 2 tallies`", async () => {
  const b = tallyOf("b", ["p"]);
  const a = tallyOf("a", ["q", "q"]);
  const seen: string[] = [];
  const r = await run(["report", URL_, "--format=compact"], serve([b, a], seen));
  expect(seen).toEqual([URL_]);
  expect(r.code).toBe(0);
  expect(lines(r.stdout)).toEqual([compact(b), compact(a), "ok report 2 tallies"]);
});

test("`keel report http://h/t?x=1`: `[]` prints `ok report 0 tallies`", async () => {
  const seen: string[] = [];
  const r = await run(["report", URL_, "--format=compact"], serve([], seen));
  expect(seen).toEqual([URL_]);
  expect(r.code).toBe(0);
  expect(lines(r.stdout)).toEqual(["ok report 0 tallies"]);
});

test("`keel report http://h/t?x=1`: printed order follows array order for arbitrary valid tallies", async () => {
  // seed 1337: ids may repeat
  await fc.assert(
    fc.asyncProperty(fc.array(fc.tuple(fc.constantFrom("a", "b", "c"), keys), { maxLength: 6 }), async (specs) => {
      const ts = specs.map(([id, ks]) => tallyOf(id, ks));
      const seen: string[] = [];
      const r = await run(["report", URL_, "--format=compact"], serve(ts, seen));
      expect(seen).toEqual([URL_]);
      expect(r.code).toBe(0);
      expect(lines(r.stdout)).toEqual([...ts.map(compact), `ok report ${ts.length} tallies`]);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
