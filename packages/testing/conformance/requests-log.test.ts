// @vitest-environment happy-dom
// Spec: k.requests (rfc:0209), Conformance "`renderRoute(id, { routes, ctx })` of a page whose loader fetches `GET https://api.example.com/a?x=1` with header `accept: application/json`, then `POST https://api.example.com/b` with headers `x-b: hidden-value` and `content-type: text/plain` and body `secret-body`, on a sim `ctx` whose net routes only `https://api.example.com/a*`: the page renders, and `requests()` is exactly `[{ method: 'GET', url: 'https://api.example.com/a?x=1', headers: ['accept'] }, { method: 'POST', url: 'https://api.example.com/b', headers: ['content-type', 'x-b'] }]`; `JSON.stringify(requests())` holds neither `hidden-value` nor `secret-body`."
// Spec: k.requests (rfc:0209), Conformance "A `ctx.net.fetch` of `https://x.example.com/t` that the test itself makes on `ctx` while a `render` handle on that `ctx` is open is the one entry of that handle's `requests()`; one made before the `render` call is in no entry; after `dispose()`, `requests()` rejects E1705."
// Spec: k.requests (rfc:0209), Conformance "On a sim ctx whose schedule `net` is `[{ delay: 0, fault: 'drop' }]`, a page's one fetch of `https://api.example.com/a` rejects and is the one entry of `requests()`; on a ctx with no route, the same fetch resolves 404, is the one entry, and the test passes."
// Spec: k.requests (rfc:0209), Request log "`headers` the names of the headers it entered `ctx.net` with, lower case, sorted, each once ... An entry holds no header value and no body"
// Seed 1337 (fc.assert below). This file makes no identity mount, so a `renderRoute` here sends no `/__keel/user` read (k.guards Client).
// ASSUMPTIONS: `requests()` on a disposed handle is asserted as "throws or rejects E1705" (`thrown` accepts either; the clause says "rejects" of a synchronous-typed call). A loader receives its ctx as `run`'s second argument (k.server).
// The app-backed clause (#4) is in packages/server/conformance/requests-log-app.test.ts.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { render, renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, cart, codeOf, simCtx, thrown } from "./fixtures.ts";

const Empty = s.object({});
const A = "https://api.example.com/a?x=1";
const B = "https://api.example.com/b";
const p = (): HTMLElement => document.createElement("p");

const rc = contract("rq", { "rq.page": { path: "/" }, "rq.two": { path: "/two" } });
const swallow = async (go: () => Promise<unknown>): Promise<void> => {
  try {
    await go();
  } catch {
    // a rejected fetch (drop) is the page's to handle; the log is what is under test
  }
};
const fetching = (calls: () => Promise<unknown>) =>
  manifest(rc, {
    "rq.page": {
      component: p,
      loader: loader(rc, "rq.page", { output: Empty }, async () => {
        await calls();
        return ok({});
      }),
    },
    "rq.two": { component: p },
  });

describe("k.requests: the log of a harness", () => {
  it("a page whose loader fetches GET a?x=1 then POST b on a net routing only a*: renders, and requests() is exactly the two entries with sorted lower-case names, holding neither `hidden-value` nor `secret-body`", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    ctx.net.route("https://api.example.com/a*", () => new Response("{}"));
    const routes = fetching(async () => {
      await ctx.net.fetch(new Request(A, { headers: { accept: "application/json" } }));
      await ctx.net.fetch(
        new Request(B, {
          method: "POST",
          headers: { "X-B": "hidden-value", "content-type": "text/plain" },
          body: "secret-body",
        }),
      );
    });
    const h = await renderRoute("rq.page", { routes, ctx });
    await h.settle();
    expect(h.route().id).toBe("rq.page");
    expect(h.requests()).toEqual([
      { method: "GET", url: A, headers: ["accept"] },
      { method: "POST", url: B, headers: ["content-type", "x-b"] },
    ]);
    const text = JSON.stringify(h.requests());
    expect(text).not.toContain("hidden-value");
    expect(text).not.toContain("secret-body");
    h.dispose();
  });

  it("for any sequence of fetches made while a handle is open, requests() lists exactly those in order, names lower-case, sorted and once, and no header value or body appears in the serialized log", async () => {
    const name = fc.constantFrom("X-A", "x-b", "Accept", "X-Trace-Id", "authorization", "Cookie", "X-Keel-User");
    const secret = fc.stringMatching(/^sk_live_[a-z0-9]{12,20}$/);
    const fetchArb = fc.record({
      method: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
      host: fc.stringMatching(/^[a-z]{3,8}$/),
      path: fc.stringMatching(/^[a-z0-9]{0,6}$/),
      headers: fc.array(fc.tuple(name, secret), { maxLength: 4 }),
      body: secret,
    });
    await fc.assert(
      fc.asyncProperty(fc.array(fetchArb, { maxLength: 6 }), async (fetches) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const routes = manifest(rc, { "rq.page": { component: p }, "rq.two": { component: p } });
        const h = await renderRoute("rq.page", { routes, ctx });
        const want: { method: string; url: string; headers: string[] }[] = [];
        const values: string[] = [];
        for (const f of fetches) {
          const url = `https://${f.host}.example.com/${f.path}`;
          const hasBody = f.method !== "GET";
          const init: RequestInit = { method: f.method, headers: f.headers, ...(hasBody ? { body: f.body } : {}) };
          const req = new Request(url, init);
          want.push({ method: req.method, url: req.url, headers: [...req.headers.keys()].sort() });
          values.push(...f.headers.map(([, v]) => v));
          if (hasBody) values.push(f.body);
          await ctx.net.fetch(req);
        }
        const log = h.requests();
        expect(log).toEqual(want);
        for (const e of log) {
          expect(Object.keys(e).sort()).toEqual(["headers", "method", "url"]);
          expect(e.headers).toEqual(e.headers.map((n) => n.toLowerCase()));
          expect(e.headers).toEqual([...e.headers].sort());
          expect(new Set(e.headers).size).toBe(e.headers.length);
        }
        const text = JSON.stringify(log);
        for (const v of values) expect(text).not.toContain(v);
        h.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("a ctx.net.fetch the test makes while a render handle is open is the one entry of requests(); one made before the render call is in no entry; after dispose() requests() rejects E1705", async () => {
    const ctx = simCtx();
    await ctx.net.fetch(new Request("https://x.example.com/before"));
    const h = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx });
    await ctx.net.fetch(new Request("https://x.example.com/t"));
    expect(h.requests()).toEqual([{ method: "GET", url: "https://x.example.com/t", headers: [] }]);
    h.dispose();
    expect(codeOf(await thrown(() => h.requests()))).toBe("E1705");
  });

  it("a fetch made after dispose() is in no entry of the earlier handle's log, and a handle opened later lists only fetches made after it opened", async () => {
    const ctx = simCtx();
    const first = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx });
    await ctx.net.fetch(new Request("https://x.example.com/one"));
    const seen = first.requests();
    first.dispose();
    await ctx.net.fetch(new Request("https://x.example.com/two"));
    const second = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx });
    await ctx.net.fetch(new Request("https://x.example.com/three"));
    expect(seen.map((e) => e.url)).toEqual(["https://x.example.com/one"]);
    expect(second.requests().map((e) => e.url)).toEqual(["https://x.example.com/three"]);
    second.dispose();
  });

  it("on a ctx whose schedule net is [{ delay: 0, fault: 'drop' }] a page's one fetch of a rejects and is the one entry of requests()", async () => {
    const ctx = createCtx({
      mode: "sim",
      seed: SEED,
      schedule: { net: [{ delay: 0, fault: "drop" }], storage: [], offline: [], plans: {} },
    });
    ctx.net.route("https://api.example.com/a*", () => new Response("{}"));
    let rejected: unknown;
    const routes = fetching(async () => {
      try {
        await ctx.net.fetch(new Request("https://api.example.com/a"));
      } catch (e) {
        rejected = e;
      }
    });
    const h = await renderRoute("rq.page", { routes, ctx });
    await h.settle();
    expect(rejected).toBeInstanceOf(TypeError);
    expect(h.requests()).toEqual([{ method: "GET", url: "https://api.example.com/a", headers: [] }]);
    h.dispose();
  });

  it("on a ctx with no route the same fetch resolves 404, is the one entry, and the test passes", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const status: number[] = [];
    const routes = fetching(async () => {
      status.push((await ctx.net.fetch(new Request("https://api.example.com/a"))).status);
    });
    const h = await renderRoute("rq.page", { routes, ctx });
    await h.settle();
    expect(status).toEqual([404]);
    expect(h.requests()).toEqual([{ method: "GET", url: "https://api.example.com/a", headers: [] }]);
    h.dispose();
  });

  it("a 503 (unavailable) and an offline fetch are logged as any other, the offline one rejecting", async () => {
    const ctx = createCtx({
      mode: "sim",
      seed: SEED,
      schedule: { net: [{ delay: 0, fault: "unavailable" }], storage: [], offline: [], plans: {} },
    });
    ctx.net.route("https://api.example.com/a*", () => new Response("{}"));
    const routes = fetching(async () => {
      await swallow(() => ctx.net.fetch(new Request("https://api.example.com/a")));
      ctx.net.setOnline(false);
      await swallow(() => ctx.net.fetch(new Request("https://api.example.com/b")));
    });
    const h = await renderRoute("rq.page", { routes, ctx });
    await h.settle();
    expect(h.requests().map((e) => e.url)).toEqual(["https://api.example.com/a", "https://api.example.com/b"]);
    h.dispose();
  });
});
