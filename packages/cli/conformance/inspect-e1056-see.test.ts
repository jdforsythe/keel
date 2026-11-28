// Spec: k.docs, clause "A diagnostic with `see` `k.ui` prints `see: keel docs k.ui` in compact and pretty, and `\"see\":\"k.ui\"` in json." (OUTPUT.md: `see` is a spec section id.)
// RFC 0247, Conformance (after the second review): k.inspect holds E1056 and E1057, so an E1056's `see` is `k.inspect`, not `k.cli`.
// Seed 1337. Driven through `run(['inspect', url], { fetch })` with an injected fetch.
// ASSUMED: the section that holds a code is the `see` of its diagnostic; compact prints `see: keel docs k.inspect` (`pnpm keel docs` when a package manager started the run).
import { run } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures";

const down = { cwd: "/work/app", fetch: (): Promise<Response> => Promise.reject(new TypeError("fetch failed")) };
const answer = (body: string, status: number) => ({
  cwd: "/work/app",
  fetch: (): Promise<Response> => Promise.resolve(new Response(body, { status })),
});
const SEE = /^\s*see: (?:pnpm )?keel docs k\.inspect$/m;

describe("k.inspect E1056 `see`", () => {
  it("an unreachable url prints `see: keel docs k.inspect` after E1056 in compact", async () => {
    const r = await run(["inspect", "http://localhost:1", "--format=compact"], down);
    expect(r.stdout.split("\n")[0]).toMatch(/^E1056 /);
    expect(r.stdout).toMatch(SEE);
    expect(r.stdout).not.toContain("k.cli");
  });
  it('json keeps "see":"k.inspect" on the E1056 diag record', async () => {
    const r = await run(["inspect", "http://localhost:1", "--format=json"], down);
    const diag = r.stdout
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l): unknown => JSON.parse(l))
      .find((v) => typeof v === "object" && v !== null && Reflect.get(v, "code") === "E1056");
    expect(diag).toBeDefined();
    expect(Reflect.get(diag ?? {}, "see")).toBe("k.inspect");
  });
  it("for any non-2xx status or non-inspect body, E1056's `see` is k.inspect", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 300, max: 599 }), async (status) => {
        const r = await run(["inspect", "--format=compact"], answer("{}", status));
        expect(r.stdout.split("\n")[0]).toMatch(/^E1056 /);
        expect(r.stdout).toMatch(SEE);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
