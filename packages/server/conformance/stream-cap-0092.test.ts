// @vitest-environment happy-dom
// Spec: k.server, clause "With `maxStreams: 2`, a third open event-stream GET is 503 `keel.busy` and runs no loader; once one closes, the next is served."
// Seed 1337 (fc.assert below). No wall time. `maxStreams` is not in `AppOptions` yet, so the app is built through createAppLoose.
import { manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, flush, liveLoader, readChunks, simCtx } from "./topology-fixtures.ts";

const sse = { accept: "text/event-stream" };

async function build(maxStreams: number | undefined) {
  let started = 0;
  const hold = liveLoader(s.object({ n: s.int() }), async function* (args: { signal: AbortSignal }) {
    started++;
    yield ok({ n: 1 });
    await new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve()));
  });
  const routes = manifest({
    "a.live": { path: "/live", loader: hold, component: () => document.createElement("main") },
  });
  const app = await createAppLoose({
    topology: topology({ x: { modules: ["a"], adapter: "node" } }),
    routes,
    ctx: simCtx(),
    mode: "dev",
    ...(maxStreams === undefined ? {} : { maxStreams }),
  });
  return { app, started: () => started };
}

describe("k.server: stream cap", () => {
  test("With `maxStreams: 2`, a third open event-stream GET is 503 `keel.busy` and runs no loader; once one closes, the next is served.", async () => {
    const { app, started } = await build(2);
    const acs = [new AbortController(), new AbortController()];
    for (const ac of acs) {
      const res = await app.fetch(new Request("http://localhost/live", { headers: sse, signal: ac.signal }));
      expect(res.status).toBe(200);
      await readChunks(res, 1);
    }
    expect(started()).toBe(2);
    const busy = await app.fetch(new Request("http://localhost/live", { headers: sse }));
    expect(busy.status).toBe(503);
    expect(await busy.text()).toContain("keel.busy");
    expect(started()).toBe(2);
    acs[0]?.abort();
    await flush();
    const next = await app.fetch(new Request("http://localhost/live", { headers: sse }));
    expect(next.status).toBe(200);
    await readChunks(next, 1);
    expect(started()).toBe(3);
    await app.close?.();
  });

  test("property: for any cap n, the (n+1)th open event-stream GET is 503 `keel.busy` with `data: { limit: n }` and runs no loader", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        const { app, started } = await build(n);
        for (let i = 0; i < n; i++) {
          const res = await app.fetch(new Request("http://localhost/live", { headers: sse }));
          expect(res.status).toBe(200);
          await readChunks(res, 1);
        }
        const busy = await app.fetch(new Request("http://localhost/live", { headers: sse }));
        expect(busy.status).toBe(503);
        const body = await busy.text();
        expect(body).toContain("keel.busy");
        expect(body).toContain(`"limit":${String(n)}`);
        expect(started()).toBe(n);
        await app.close?.();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("a stream that ends for any reason frees its place (the loader returns, or close() ends the rest)", async () => {
    let started = 0;
    const once = liveLoader(s.object({ n: s.int() }), async function* () {
      started++;
      yield ok({ n: 1 });
    });
    const routes = manifest({
      "a.live": { path: "/live", loader: once, component: () => document.createElement("main") },
    });
    const app = await createAppLoose({
      topology: topology({ x: { modules: ["a"], adapter: "node" } }),
      routes,
      ctx: simCtx(),
      mode: "dev",
      maxStreams: 1,
    });
    for (let i = 0; i < 3; i++) {
      const res = await app.fetch(new Request("http://localhost/live", { headers: sse }));
      expect(res.status).toBe(200);
      await res.text();
      await flush();
    }
    expect(started).toBe(3);
  });

  test("the default cap is 1,000 open event streams per app: stream 1,001 is 503 `keel.busy` with `data: { limit: 1000 }`", async () => {
    const { app, started } = await build(undefined);
    for (let i = 0; i < 1000; i++) {
      const res = await app.fetch(new Request("http://localhost/live", { headers: sse }));
      expect(res.status).toBe(200);
      await readChunks(res, 1);
    }
    const busy = await app.fetch(new Request("http://localhost/live", { headers: sse }));
    expect(busy.status).toBe(503);
    expect(await busy.text()).toContain('"limit":1000');
    expect(started()).toBe(1000);
    await app.close?.();
  }, 60_000);
});
