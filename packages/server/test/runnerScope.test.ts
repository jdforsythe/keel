// @vitest-environment node
// k.privacy Server log: each call of a runner's `run` enters a fresh scrub scope, so a `Secret` it makes joins that
// call's set and no outer request's, its rejection is reported with that set, and a rerun gets a new one.
import { createCtx } from "@keel/ctx";
import { reveal, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { keepRunning } from "../src/internal/keepRunning.ts";
import { noteRequestSecrets } from "../src/internal/noteRequestSecrets.ts";
import { requestSecrets } from "../src/internal/requestSecrets.ts";

const made = <T>(r: { ok: true; value: T } | { ok: false }): T => {
  if (!r.ok) throw new Error("parse failed");
  return r.value;
};
const flush = () => new Promise<void>((done) => setTimeout(done, 0));

describe("a runner's scrub scope", () => {
  it("holds what each run makes in a fresh set, never the enclosing request's", async () => {
    noteRequestSecrets();
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const stop = new AbortController();
    const outer = new Set<string>();
    const seen: { message: string; secrets: Set<string> }[] = [];
    let n = 0;
    const runner = {
      run: async () => {
        await Promise.resolve();
        n++;
        throw new Error(`runner ${reveal(made(s.secret(s.string()).parse(`run-${n}-5d3c1f`)))}`);
      },
    };
    const done = requestSecrets.run(outer, () =>
      keepRunning(
        runner,
        ctx,
        stop.signal,
        (message, _frames, secrets) => void seen.push({ message, secrets }),
        () => [],
      ),
    );
    await flush();
    ctx.clock.advance(1000);
    await flush();
    stop.abort();
    await done;
    expect(seen.length).toBeGreaterThanOrEqual(2);
    const [first, second] = seen;
    expect(first?.secrets.has("run-1-5d3c1f")).toBe(true);
    expect(second?.secrets.has("run-2-5d3c1f")).toBe(true);
    expect(second?.secrets.has("run-1-5d3c1f")).toBe(false);
    expect(first?.secrets).not.toBe(second?.secrets);
    expect(outer.size).toBe(0);
    expect(requestSecrets.getStore()).toBeUndefined();
  });
});
