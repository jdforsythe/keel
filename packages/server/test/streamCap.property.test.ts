// @vitest-environment node
// The open event-stream cap (k.server Request flow): for any sequence of opens and closes against `maxStreams: n`, an
// open is served exactly when fewer than n streams are open, a refused one is 503 `keel.busy` and runs no loader, and
// streams refused by a guard or a 406 take no place. Seed 1337, sim ctx, no wall time.
import { createCtx } from "@keel/ctx";
import { guard, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const sse = { accept: "text/event-stream" };

async function flush(): Promise<void> {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

async function app(maxStreams: number) {
  const seen = { started: 0 };
  const hold = loader({ output: s.object({ n: s.int() }) }, async function* ({ signal }, ctx) {
    seen.started++;
    yield ok({ n: 1 });
    await ctx.clock.after(3_600_000, signal).catch(() => undefined);
  });
  const routes = manifest({
    "a.live": { path: "/live", loader: hold, component: () => document.createElement("main") },
    "a.shut": {
      path: "/shut",
      loader: hold,
      guard: guard({ redirect: "a.page" }, () =>
        Promise.resolve(err({ code: "keel.denied", message: "no", data: null })),
      ),
      component: () => document.createElement("main"),
    },
    "a.page": {
      path: "/page",
      loader: loader({ output: s.object({ n: s.int() }) }, () => Promise.resolve(ok({ n: 1 }))),
      component: () => document.createElement("main"),
    },
  });
  const served = await createApp({
    topology: topology({ x: { modules: ["a"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    maxStreams,
  });
  return { served, seen };
}

async function open(fetch: (r: Request) => Promise<Response>, path: string, ac: AbortController) {
  const res = await fetch(new Request(`http://h${path}`, { headers: sse, signal: ac.signal }));
  if (res.status === 200) await res.body?.getReader().read();
  return res;
}

describe("open event-stream cap", () => {
  it("serves an open exactly when fewer than maxStreams streams are open", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), fc.array(fc.boolean(), { maxLength: 16 }), async (n, ops) => {
        const { served, seen } = await app(n);
        const live: AbortController[] = [];
        let started = 0;
        for (const isOpen of ops) {
          if (isOpen) {
            const ac = new AbortController();
            const res = await open((r) => served.fetch(r), "/live", ac);
            if (live.length < n) {
              expect(res.status).toBe(200);
              live.push(ac);
              started++;
            } else {
              expect(res.status).toBe(503);
              expect(await res.json()).toEqual({
                ok: false,
                error: { code: "keel.busy", message: expect.any(String), data: { limit: n } },
              });
            }
          } else {
            live.shift()?.abort();
            await flush();
          }
          expect(seen.started).toBe(started);
        }
        await served.close();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a stream refused by its guard or answered 406 takes no place", async () => {
    const { served } = await app(1);
    expect((await open((r) => served.fetch(r), "/shut", new AbortController())).status).toBe(403);
    expect((await open((r) => served.fetch(r), "/page", new AbortController())).status).toBe(406);
    expect((await open((r) => served.fetch(r), "/live", new AbortController())).status).toBe(200);
    expect((await open((r) => served.fetch(r), "/live", new AbortController())).status).toBe(503);
    await served.close();
    await flush();
  });
});
