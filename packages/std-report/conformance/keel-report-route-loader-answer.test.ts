// Spec: std.report, clause "For a `url` with a path, a body `{ id, results: { [id]: { ok: true, value } } }` prints as the body `value` does, for a `Tally` and for an array of tallies; with `results[id]` absent or `{ ok: false, error }`, or a `value` that is neither, it emits E1056 and exits 1."
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
const ID = "q1";
const answer = (value: unknown) => ({ id: ID, results: { [ID]: { ok: true, value } } });
const serve = (body: unknown, seen: string[]) => ({
  cwd: "/work/app",
  files: [],
  fetch: (url: string): Promise<Response> => {
    seen.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  },
});
const go = async (body: unknown) => {
  const seen: string[] = [];
  const r = await run(["report", URL_, "--format=compact"], serve(body, seen));
  expect(seen).toEqual([URL_]);
  return r;
};

test("a loader answer for a `Tally` prints as the body `value` does", async () => {
  const t = tallyOf("a", ["x", "y", "x"]);
  const bare = await go(t);
  const wrapped = await go(answer(t));
  expect(wrapped.stdout).toBe(bare.stdout);
  expect(wrapped.code).toBe(bare.code);
  expect(wrapped.code).toBe(0);
  expect(lines(wrapped.stdout)).toEqual([compact(t), "ok report 1 tallies"]);
});

test("a loader answer for an array of tallies prints as the body `value` does", async () => {
  const b = tallyOf("b", ["p"]);
  const a = tallyOf("a", ["q", "q"]);
  const bare = await go([b, a]);
  const wrapped = await go(answer([b, a]));
  expect(wrapped.stdout).toBe(bare.stdout);
  expect(wrapped.code).toBe(bare.code);
  expect(wrapped.code).toBe(0);
  expect(lines(wrapped.stdout)).toEqual([compact(b), compact(a), "ok report 2 tallies"]);
});

test("a loader answer for arbitrary valid tally arrays prints as the bare array does", async () => {
  // seed 1337
  await fc.assert(
    fc.asyncProperty(fc.array(fc.tuple(fc.constantFrom("a", "b", "c"), keys), { maxLength: 6 }), async (specs) => {
      const ts = specs.map(([id, ks]) => tallyOf(id, ks));
      const bare = await go(ts);
      const wrapped = await go(answer(ts));
      expect(wrapped.stdout).toBe(bare.stdout);
      expect(wrapped.code).toBe(bare.code);
    }),
    { seed: 1337, numRuns: 25 },
  );
});

const bad: [string, unknown][] = [
  ["`results` empty", { id: ID, results: {} }],
  [
    "`results[id]` present only under a different key",
    { id: ID, results: { other: { ok: true, value: tallyOf("a", ["x"]) } } },
  ],
  [
    "`results[id]` is `{ ok: false, error }`",
    { id: ID, results: { [ID]: { ok: false, error: { code: "E0001", message: "no" } } } },
  ],
  ["`value` is a string", answer("nope")],
  ["`value` is an object failing `Tally`", answer({ id: 1, rows: "x" })],
  ["`value` is an array with one bad item", answer([tallyOf("a", ["x"]), { id: 2 }])],
];

for (const [name, body] of bad) {
  test(`a loader answer with ${name} emits E1056 and exits 1`, async () => {
    const r = await go(body);
    expect(r.code).toBe(1);
    expect(r.stdout + (r.stderr ?? "")).toContain("E1056");
  });
}
