import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
// ASSUMPTION (public API not visible from index.ts): sim net is `ctx.net.route(url, handler)` where the
// handler receives a request with `url`/`signal` and returns a standard Response; sim clock has `advance(ms)`.
const BASE = "https://api.example.com";
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};

describe("k.services: timeout", () => {
  it("Under sim, with no response, advancing the clock to `timeout - 1` leaves the call pending; advancing to `timeout` yields `api.timeout` and aborts the request signal", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 60000 }), async (timeout) => {
        const Out = s.object({ n: s.int() });
        const api = service({
          base: BASE,
          schema: endpoints({ get: { method: "GET", path: "/slow", output: Out, timeout } }),
          timeout: 10 ** 9,
        });
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        let aborted = false;
        ctx.net.route(`${BASE}/slow`, (req) => {
          req.signal.addEventListener("abort", () => {
            aborted = true;
          });
          return new Promise<Response>(() => {});
        });
        let settled: unknown = null;
        const pending = api.get({}, ctx).then((r) => {
          settled = r;
          return r;
        });
        await flush();
        ctx.clock.advance(timeout - 1);
        await flush();
        expect(settled).toBeNull();
        expect(aborted).toBe(false);
        ctx.clock.advance(1);
        const r = await pending;
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.timeout");
          expect(r.error.data.ms).toBe(timeout);
        }
        expect(aborted).toBe(true);
      }),
      { seed: 1337 },
    );
  });

  it("service timeout defaults to 10,000 ms", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({ get: { method: "GET", path: "/slow", output: s.object({}) } }),
    });
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(`${BASE}/slow`, () => new Promise<Response>(() => {}));
    let settled = false;
    const pending = api.get({}, ctx).then((r) => {
      settled = true;
      return r;
    });
    await flush();
    ctx.clock.advance(9999);
    await flush();
    expect(settled).toBe(false);
    ctx.clock.advance(1);
    const r = await pending;
    expect(!r.ok && r.error.code).toBe("api.timeout");
  });

  it("an endpoint `timeout` overrides the service timeout", async () => {
    const api = service({
      base: BASE,
      timeout: 50000,
      schema: endpoints({ get: { method: "GET", path: "/slow", output: s.object({}), timeout: 100 } }),
    });
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(`${BASE}/slow`, () => new Promise<Response>(() => {}));
    const pending = api.get({}, ctx);
    await flush();
    ctx.clock.advance(100);
    const r = await pending;
    expect(!r.ok && r.error.code).toBe("api.timeout");
  });
});
