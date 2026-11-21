// Spec: std.report, clause "`keel report` against an unreachable url, a non-2xx answer or a body that is not an inspect document emits E1056 and exits 1."
// Seed 1337
import { run } from "@keel/cli";
import "@keel/std-report/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const reply = (body: string, status: number) => ({
  cwd: "/work/app",
  files: [],
  fetch: (): Promise<Response> => Promise.resolve(new Response(body, { status })),
});
const first = (out: string): string => out.split("\n")[0] ?? "";

test("`keel report` against an unreachable url, a non-2xx answer or a body that is not an inspect document emits E1056 and exits 1.", async () => {
  const down = {
    cwd: "/work/app",
    files: [],
    fetch: (): Promise<Response> => Promise.reject(new TypeError("fetch failed")),
  };
  const bad = [
    await run(["report", "http://localhost:1", "--format=compact"], down),
    await run(["report", "--format=compact"], reply("{}", 404)),
    await run(["report", "--format=compact"], reply("{}", 500)),
    await run(["report", "--format=compact"], reply("<html>", 200)),
    await run(["report", "--format=compact"], reply(JSON.stringify({ live: true }), 200)),
  ];
  for (const r of bad) {
    expect(r.code).toBe(1);
    expect(first(r.stdout)).toMatch(/^E1056 /);
  }
  // seed 1337: any non-2xx status
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 300, max: 599 }), async (status) => {
      const r = await run(["report", "--format=compact"], reply("{}", status));
      expect(r.code).toBe(1);
      expect(first(r.stdout)).toMatch(/^E1056 /);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
