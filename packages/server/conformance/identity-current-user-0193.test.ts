// Spec: k.user, Conformance "With `identify` answering `'u1'` at open and `''` after, a live loader's `currentUser()` answers `''`, one `identify` call per call; a stream opened with a verified `x-keel-user: u1`, `'u1'` with no `identify` call."
// Spec: k.user, User "A live loader's args have `currentUser()`, `Promise<string>`: `identify` run again on the request the stream opened with (without its body), under the same rules; a throw, an invalid answer or 5,000 ms on `ctx.clock` answers `''` with the same `diag`. With no identity source it answers `''`; for a stream whose `user` came from a verified `x-keel-user` or from `renderRoute`'s `user`, that `user`, and no `identify` runs."
// Seed 1337 (fc.assert below). The verified `x-keel-user` half needs `service`, which this package does not depend on: packages/cli/conformance/identity-current-user-verified-0193.test.ts.
// Pending (rfc:0193): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: the live loader's args carry `currentUser` typed `() => Promise<string>`; the sim ctx's clock is the one `identify` is bounded on.
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { liveLoader, readChunks } from "./topology-fixtures.ts";

const SEED = 1337;
const BASE = "http://localhost";
const Now = s.object({ user: s.string(), current: s.string() });

type Identify = (a: { request: Request; caller: string }, ctx: Ctx) => Promise<string>;

async function rig(identify: Identify | undefined) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const calls: Request[] = [];
  const waiters: (() => void)[] = [];
  const c = contract("app", { "app.live": { method: "GET", path: "/api/live", events: true, output: Now } });
  const live = liveLoader(
    c,
    "app.live",
    async function* (args: { user: string; signal: AbortSignal; currentUser: () => Promise<string> }) {
      for (;;) {
        yield ok({ user: args.user, current: await args.currentUser() });
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          args.signal.addEventListener("abort", () => resolve());
        });
        if (args.signal.aborted) return;
      }
    },
  );
  const routes = manifest(c, { "app.live": { loader: live } });
  const source =
    identify === undefined
      ? {}
      : {
          identity: identity({
            identify: async (a, cx) => {
              calls.push(a.request);
              return identify(a, cx);
            },
          }),
        };
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
    ...source,
  });
  const ac = new AbortController();
  const res = await app.fetch(
    new Request(`${BASE}/api/live`, { headers: { accept: "text/event-stream" }, signal: ac.signal }),
  );
  return {
    ctx,
    calls,
    res,
    /** Lets the live loader ask `currentUser()` once more and yield. */
    pulse: () => waiters.shift()?.(),
    close: () => ac.abort(),
  };
}

const answerOf = (chunk: string): unknown => {
  const line = chunk.split("\n").find((l) => l.startsWith("data:"));
  return line === undefined ? undefined : JSON.parse(line.slice(5));
};

describe("k.user: currentUser() in a live loader", () => {
  test.skip("With `identify` answering `'u1'` at open and `''` after, a live loader's `currentUser()` answers `''`, one `identify` call per call", async () => {
    let n = 0;
    const r = await rig(async () => (n++ === 0 ? "u1" : ""));
    const chunks = await readChunks(r.res, 1);
    expect(answerOf(chunks.join(""))).toEqual({ ok: true, value: { user: "u1", current: "" } });
    // one call at open, one for the first currentUser()
    expect(r.calls).toHaveLength(2);
    r.close();
  });

  test.skip("`currentUser()` answers `''` after the identity changed, one `identify` call per call, for any number of calls", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (k) => {
        let n = 0;
        const r = await rig(async () => (n++ === 0 ? "u1" : ""));
        const reader = r.res.body?.getReader();
        if (reader === undefined) throw new Error("no body");
        const dec = new TextDecoder();
        const got: unknown[] = [];
        for (let i = 0; i <= k; i++) {
          if (i > 0) r.pulse();
          const chunk = await reader.read();
          got.push(answerOf(dec.decode(chunk.value)));
        }
        expect(
          got.every((g) => JSON.stringify(g) === JSON.stringify({ ok: true, value: { user: "u1", current: "" } })),
        ).toBe(true);
        expect(r.calls).toHaveLength(1 + (k + 1));
        r.close();
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test.skip("`currentUser()` runs `identify` on the request the stream opened with, without its body", async () => {
    const r = await rig(async () => "u1");
    await readChunks(r.res, 1);
    expect(r.calls).toHaveLength(2);
    const [open, again] = r.calls;
    expect(again?.url).toBe(open?.url);
    expect(again?.method).toBe("GET");
    expect(again?.body).toBeNull();
    r.close();
  });

  test.skip("`currentUser()` answers `''` for an `identify` that throws, answers `42`, or never settles by 5,000 ms on `ctx.clock`", async () => {
    for (const mode of ["throw", "invalid", "hang"] as const) {
      let n = 0;
      const r = await rig(async (_a, cx) => {
        if (n++ === 0) return "u1";
        if (mode === "throw") throw new TypeError("t-123");
        if (mode === "invalid") return Promise.resolve(JSON.parse("42"));
        return new Promise<string>(() => undefined);
      });
      const reader = r.res.body?.getReader();
      if (reader === undefined) throw new Error("no body");
      const first = reader.read();
      for (let i = 0; i < 50; i++) await Promise.resolve();
      r.ctx.clock.advance(5_000);
      const chunk = await first;
      expect(answerOf(new TextDecoder().decode(chunk.value))).toEqual({
        ok: true,
        value: { user: "u1", current: "" },
      });
      r.close();
    }
  });

  test.skip("With no identity source, `currentUser()` answers `''`", async () => {
    const r = await rig(undefined);
    const chunks = await readChunks(r.res, 1);
    expect(answerOf(chunks.join(""))).toEqual({ ok: true, value: { user: "", current: "" } });
    r.close();
  });
});
