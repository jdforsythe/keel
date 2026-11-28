// Spec: std.report, clause "With `@keel/std-report/tools` imported, `keel report <url>` against an inspect document with sections `b` and `a` holding tallies and a section of another shape prints the compact line of `a`, then of `b`, then `ok report 2 tallies`, and exits 0; with no tally section it prints `ok report 0 tallies`."
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
const inspectDoc = (sections: Record<string, unknown>) => ({
  live: true,
  graph: { nodes: [], edges: [] },
  stores: {},
  ids: {},
  a11y: {},
  routes: {},
  sections,
});
const io = (body: unknown, seen: string[] = []) => ({
  cwd: "/work/app",
  files: [],
  fetch: (url: string): Promise<Response> => {
    seen.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  },
});

test("With `@keel/std-report/tools` imported, `keel report <url>` against an inspect document with sections `b` and `a` holding tallies and a section of another shape prints the compact line of `a`, then of `b`, then `ok report 2 tallies`, and exits 0; with no tally section it prints `ok report 0 tallies`.", async () => {
  await fc.assert(
    fc.asyncProperty(keys, keys, async (ka, kb) => {
      const a = tallyOf("a", ka);
      const b = tallyOf("b", kb);
      const seen: string[] = [];
      const doc = inspectDoc({
        b: { doc: "tally", value: b },
        a: { doc: "tally", value: a },
        c: { doc: "count", value: { n: 3 } },
      });
      const r = await run(["report", "http://localhost:4000", "--format=compact"], io(doc, seen));
      expect(seen).toEqual(["http://localhost:4000/__keel/inspect"]);
      expect(r.code).toBe(0);
      expect(lines(r.stdout)).toEqual([compact(a), compact(b), "ok report 2 tallies"]);
    }),
    { seed: 1337, numRuns: 25 },
  );
  const none = await run(
    ["report", "http://localhost:4000", "--format=compact"],
    io(inspectDoc({ c: { doc: "count", value: { n: 3 } }, d: { doc: "x", error: "E1057 boom" } })),
  );
  expect(none.code).toBe(0);
  expect(lines(none.stdout)).toEqual(["ok report 0 tallies"]);
  const empty = await run(["report", "http://localhost:4000", "--format=compact"], io(inspectDoc({})));
  expect(lines(empty.stdout)).toEqual(["ok report 0 tallies"]);
});

test("`keel report [url]` defaults to http://localhost:5173 (spec: Reaching a person)", async () => {
  const seen: string[] = [];
  await run(["report", "--format=compact"], io(inspectDoc({}), seen));
  expect(seen).toEqual(["http://localhost:5173/__keel/inspect"]);
});
