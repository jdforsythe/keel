// Spec: std.report, clause "For a `url` with a path or a query, a non-2xx answer, a body that is not JSON, an inspect document, or an array with an item failing `Tally` emits E1056, exits 1 and prints no part of the query."
// Seed 1337
import { run } from "@keel/cli";
import { tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const reply = (body: string, status: number) => ({
  cwd: "/work/app",
  files: [],
  fetch: (): Promise<Response> => Promise.resolve(new Response(body, { status })),
});
const first = (out: string): string => out.split("\n")[0] ?? "";
const inspectDoc = {
  live: true,
  graph: { nodes: [], edges: [] },
  stores: {},
  ids: {},
  a11y: {},
  routes: {},
  sections: {},
};

test("For a `url` with a path or a query, a non-2xx answer, a body that is not JSON, an inspect document, or an array with an item failing `Tally` emits E1056 and exits 1", async () => {
  const cases = [
    reply("{}", 404),
    reply("{}", 500),
    reply("<html>", 200),
    reply(JSON.stringify(inspectDoc), 200),
    reply(JSON.stringify([tallyOf("a", ["x"]), { kind: "report.tally" }]), 200),
  ];
  for (const url of ["http://h/t", "http://h/t?x=1", "http://h/?x=1"]) {
    for (const io of cases) {
      const r = await run(["report", url, "--format=compact"], io);
      expect(r.code).toBe(1);
      expect(first(r.stdout)).toMatch(/^E1056 /);
    }
  }
  // seed 1337: any non-2xx status
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 300, max: 599 }), async (status) => {
      const r = await run(["report", "http://h/t?x=1", "--format=compact"], reply("{}", status));
      expect(r.code).toBe(1);
      expect(first(r.stdout)).toMatch(/^E1056 /);
    }),
    { seed: 1337, numRuns: 25 },
  );
});

test("For a `url` with a path or a query, E1056 prints no part of the query (compact and json)", async () => {
  const url = "http://h/t?secret=abc123";
  const cases = [
    reply("{}", 404),
    reply("{}", 500),
    reply("<html>", 200),
    reply(JSON.stringify(inspectDoc), 200),
    reply(JSON.stringify([{ kind: "report.tally" }]), 200),
    {
      cwd: "/work/app",
      files: [],
      fetch: (u: string): Promise<Response> => Promise.reject(new TypeError(`fetch failed ${u}`)),
    },
  ];
  for (const format of ["--format=compact", "--format=json"]) {
    for (const io of cases) {
      const r = await run(["report", url, format], io);
      expect(r.code).toBe(1);
      for (const text of [r.stdout, r.stderr]) {
        expect(text).not.toContain("secret");
        expect(text).not.toContain("abc123");
      }
    }
  }
});
