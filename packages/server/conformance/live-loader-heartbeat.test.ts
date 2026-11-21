// @vitest-environment happy-dom
// Spec: k.server Request flow, "a `:` line per 15 s of `ctx.clock`". Seed 1337 (fc.assert below).
// The 15 s are observed on the sim clock: `ctx.clock.advance` only, no timers.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, flush, liveLoader, simCtx } from "./topology-fixtures.ts";

describe("k.server: live loader heartbeat", () => {
  test("An event stream writes a `:` line per 15 s of `ctx.clock` until `fn` returns or `signal` aborts.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (beats) => {
        const appContract = contract("app", {
          "app.live": { method: "GET", path: "/api/live", events: true, output: s.object({ n: s.int() }) },
        });
        const live = liveLoader(appContract, "app.live", async function* (args: { signal: AbortSignal }) {
          yield ok({ n: 1 });
          await new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve()));
        });
        const routes = manifest(appContract, {
          "app.live": { loader: live },
        });
        const ctx = simCtx();
        const app = await createAppLoose({
          topology: topology({ web: { modules: ["app"], adapter: "node" } }),
          routes,
          ctx,
          mode: "dev",
        });
        const res = await app.fetch(
          new Request("http://localhost/api/live", { headers: { accept: "text/event-stream" } }),
        );
        const reader = res.body?.getReader();
        const dec = new TextDecoder();
        let seen = "";
        const pump = (async () => {
          for (;;) {
            const r = await reader?.read();
            if (r === undefined || r.done) return;
            seen += dec.decode(r.value);
          }
        })();
        await flush();
        const heartbeats = () => seen.split("\n").filter((l) => l.startsWith(":")).length;
        expect(heartbeats()).toBe(0);
        ctx.clock.advance(14_999);
        await flush();
        expect(heartbeats()).toBe(0);
        ctx.clock.advance(1);
        await flush();
        expect(heartbeats()).toBe(1);
        for (let i = 1; i < beats; i++) {
          ctx.clock.advance(15_000);
          await flush();
        }
        expect(heartbeats()).toBe(beats);
        await app.close?.();
        await pump;
      }),
      { seed: SEED, numRuns: 5 },
    );
  });
});
