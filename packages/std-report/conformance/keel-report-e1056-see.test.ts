// Spec: k.docs, clause "A diagnostic with `see` `k.ui` prints `see: keel docs k.ui` in compact and pretty, and `\"see\":\"k.ui\"` in json." (OUTPUT.md: `see` is a spec section id.)
// RFC 0247, Conformance (after the second review): k.inspect holds E1056, so `keel report`'s E1056 carries `see` `k.inspect`, not `k.cli`.
// Seed 1337
// ASSUMED: the section that holds a code is the `see` of its diagnostic.
import { run } from "@keel/cli";
import "@keel/std-report/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const reply = (body: string, status: number) => ({
  cwd: "/work/app",
  files: [],
  fetch: (): Promise<Response> => Promise.resolve(new Response(body, { status })),
});
const SEE = /^\s*see: (?:pnpm )?keel docs k\.inspect$/m;

test("`keel report` against an unreachable url emits E1056 whose `see` is k.inspect", async () => {
  const down = {
    cwd: "/work/app",
    files: [],
    fetch: (): Promise<Response> => Promise.reject(new TypeError("fetch failed")),
  };
  const r = await run(["report", "http://localhost:1", "--format=compact"], down);
  expect(r.stdout.split("\n")[0]).toMatch(/^E1056 /);
  expect(r.stdout).toMatch(SEE);
  expect(r.stdout).not.toContain("k.cli");
  const j = await run(["report", "http://localhost:1", "--format=json"], down);
  expect(j.stdout).toContain('"see":"k.inspect"');
});

test("for any non-2xx status, `keel report`'s E1056 `see` is k.inspect", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 300, max: 599 }), async (status) => {
      const r = await run(["report", "--format=compact"], reply("{}", status));
      expect(r.stdout.split("\n")[0]).toMatch(/^E1056 /);
      expect(r.stdout).toMatch(SEE);
    }),
    { seed: 1337, numRuns: 10 },
  );
});
