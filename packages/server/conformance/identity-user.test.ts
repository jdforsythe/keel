// Spec: k.user, clause "With `identify` answering `'u1'`, a guard, a loader, an action and a live loader's stream each get `user` `'u1'`, one `identify` call per request; with no identity source, `''`; `renderRoute(id, { user: 'u1' })` gives guard and loader `'u1'`."
// k.user, User "Guards, loaders (live too) and actions get `user: string` beside `caller`: `identify`'s answer; `''` with no identity source, on a `client` deployable, or under `renderRoute` without its `user` option."
// k.user, Identity source "`identify({ request, caller }, ctx)` returns `Promise<string>`: a user id, `''` for no one. `request` is the incoming `Request` without its body."
// k.user, Identity source "It runs once per request the deployable answers on a route (page, API route, event stream), after the same-site check and before guards; never for assets, `/__keel/*`, a forwarded path or `handle`. The kernel keeps no answer across requests."
// k.user, User "An event stream keeps the `user` it opened with until it closes."
// Seed 1337 (fc.assert below). renderRoute's half is packages/testing/conformance/render-route-user.test.ts; the forwarded path, in identity-peers.test.ts; `handle`, in identity-handle.test.ts.
// Runs under plain Node; every request is a runtime (JSON) request or an event stream.
// @vitest-environment node
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, cookieOf, rig } from "./identity-support.ts";
import { flush, readChunks, simCtx } from "./topology-fixtures.ts";

const userId = fc.string({ minLength: 1, maxLength: 256 });

describe("k.user: the user a request carries", () => {
  test("With `identify` answering `'u1'`, a guard, a loader, an action and a live loader's stream each get `user` `'u1'`, one `identify` call per request", async () => {
    const r = await rig({ identify: async () => "u1" });
    expect((await r.get("/who")).status).toBe(200);
    expect(r.seen.guard).toEqual(["u1"]);
    expect(r.seen.loader).toEqual(["u1"]);
    expect(r.identified).toHaveLength(1);
    expect((await r.post("/who")).status).toBeLessThan(400);
    expect(r.seen.action).toEqual(["u1"]);
    expect(r.identified).toHaveLength(2);
    expect((await r.get("/api/who")).status).toBe(200);
    expect(r.seen.api).toEqual(["u1"]);
    expect(r.identified).toHaveLength(3);
    const ac = new AbortController();
    const res = await r.stream("/api/live", ac.signal);
    expect(res.status).toBe(200);
    const text = (await readChunks(res, 1)).join("");
    expect(text).toContain("u1");
    expect(r.seen.live).toEqual(["u1"]);
    expect(r.identified).toHaveLength(4);
    ac.abort();
  });

  test("any user id of at most 256 characters `identify` answers is the `user` of guard, loader and action", async () => {
    await fc.assert(
      fc.asyncProperty(userId, async (id) => {
        const r = await rig({ identify: async () => id });
        await r.get("/who");
        await r.post("/who");
        // k.server's request flow runs the guard before the GET's loaders and before the POST's action.
        expect(r.seen.guard).toEqual([id, id]);
        expect(r.seen.loader).toEqual([id]);
        expect(r.seen.action).toEqual([id]);
        expect(r.identified).toHaveLength(2);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("with no identity source, `user` is `''` for a guard, a loader, an action and a live loader", async () => {
    const r = await rig();
    await r.get("/who");
    await r.post("/who");
    await r.get("/api/who");
    const ac = new AbortController();
    await readChunks(await r.stream("/api/live", ac.signal), 1);
    ac.abort();
    expect(r.seen.guard).toEqual(["", ""]);
    expect(r.seen.loader).toEqual([""]);
    expect(r.seen.action).toEqual([""]);
    expect(r.seen.api).toEqual([""]);
    expect(r.seen.live).toEqual([""]);
  });

  test("`identify` returns `Promise<string>`: a user id, `''` for no one", async () => {
    const r = await rig({ identify: async () => "" });
    await r.get("/who");
    expect(r.seen.loader).toEqual([""]);
    expect(r.identified).toHaveLength(1);
  });

  test("`identify({ request, caller }, ctx)` gets the incoming `Request` without its body, the request's `caller` and the app's ctx", async () => {
    const got: { method: string; url: string; header: string | null; body: unknown; caller: string; ctx: unknown }[] =
      [];
    const r = await rig({
      identify: async ({ request, caller }, ctx) => {
        got.push({
          method: request.method,
          url: request.url,
          header: request.headers.get("x-probe"),
          body: request.body,
          caller,
          ctx,
        });
        return "u1";
      },
    });
    const first = await r.post("/who", { user: "x" }, { "x-probe": "p1" });
    const minted = cookieOf(first, "keel-caller")?.split(";")[0] ?? "";
    expect(minted).not.toBe("");
    await r.get("/who?user=q", { "x-probe": "p2", cookie: minted });
    expect(got[0]?.method).toBe("POST");
    expect(got[0]?.url).toBe("http://localhost/who");
    expect(got[0]?.header).toBe("p1");
    expect(got[0]?.body).toBeNull();
    expect(got[0]?.caller).toBe("");
    expect(got[0]?.ctx).toBeDefined();
    expect(got[1]?.method).toBe("GET");
    expect(got[1]?.url).toBe("http://localhost/who?user=q");
    expect(got[1]?.header).toBe("p2");
    expect(got[1]?.caller).not.toBe("");
    expect(r.seen.action).toEqual(["u1"]);
  });

  test("`identify` runs after the same-site check: a cross-site POST is 403 and `identify` is not called", async () => {
    const r = await rig({ identify: async () => "u1" });
    const res = await r.post("/who", {}, { origin: "http://evil.example", "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect(r.identified).toHaveLength(0);
    expect(r.seen.action).toEqual([]);
  });

  test("`identify` runs before guards, and a request to a route runs it once", async () => {
    const r = await rig({ identify: async () => "u1" });
    await r.get("/who");
    expect(r.seen.order).toEqual(["identify", "guard", "loader"]);
    await r.post("/who");
    expect(r.seen.order.slice(3)).toEqual(["identify", "guard", "action"]);
  });

  test("`identify` is never called for the generated entry, `/__keel/*` or a path no route serves", async () => {
    const r = await rig({ identify: async () => "u1" });
    await r.app.fetch(new Request("http://localhost/@keel/entry.ts"));
    await r.app.fetch(
      new Request("http://localhost/__keel/csp", {
        method: "POST",
        body: JSON.stringify({ "csp-report": { "violated-directive": "img-src" } }),
        headers: { "content-type": "application/csp-report" },
      }),
    );
    await r.app.fetch(new Request("http://localhost/__keel/inspect"));
    await r.get("/no-such-route");
    expect(r.identified).toHaveLength(0);
  });

  test("The kernel keeps no answer across requests: two requests with different headers get different users and a changed answer for the same headers is seen", async () => {
    await fc.assert(
      fc.asyncProperty(userId, userId, async (a, b) => {
        let answer = a;
        const r = await rig({ identify: async ({ request }) => request.headers.get("x-who") ?? answer });
        await r.get("/who", { "x-who": a });
        await r.get("/who", { "x-who": `${b}.` });
        expect(r.seen.loader).toEqual([a, `${b}.`]);
        const same = { "x-trace": "same" };
        answer = a;
        await r.get("/who", same);
        answer = `${a}!`;
        await r.get("/who", same);
        expect(r.seen.loader.slice(2)).toEqual([a, `${a}!`]);
        expect(r.identified).toHaveLength(4);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("An event stream keeps the `user` it opened with until it closes", async () => {
    let answer = "u1";
    const r = await rig({ identify: async () => answer });
    const ac = new AbortController();
    const res = await r.stream("/api/live", ac.signal);
    const reader = res.body?.getReader();
    const dec = new TextDecoder();
    let text = "";
    const pump = (async () => {
      for (;;) {
        const chunk = await reader?.read().catch(() => undefined);
        if (chunk === undefined || chunk.done) return;
        text += dec.decode(chunk.value);
      }
    })();
    await flush();
    answer = "u2";
    await r.get("/who");
    expect(r.seen.loader).toEqual(["u2"]);
    r.release.resolve();
    await flush();
    expect(r.seen.live).toEqual(["u1"]);
    expect(text.split("data:").length - 1).toBe(2);
    expect(text).not.toContain("u2");
    expect(r.identified).toHaveLength(2);
    ac.abort();
    await pump;
  });
});

describe("k.user: no identity source", () => {
  test("`createApp` without `identity` serves a loader whose `user` is `''` whatever the request carries", async () => {
    const seen: string[] = [];
    const appContract = contract("app", {
      "app.who": { method: "GET", path: "/who", output: s.object({ user: s.string() }) },
    });
    const read = loader(appContract, "app.who", {}, async ({ user }) => {
      seen.push(user);
      return ok({ user });
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest(appContract, { "app.who": { loader: read } }),
      ctx: simCtx(),
      mode: "production",
    });
    await app.fetch(
      new Request("http://localhost/who?user=u2", {
        headers: { accept: "application/json", "x-keel-user": "u2", cookie: "user=u2" },
      }),
    );
    expect(seen).toEqual([""]);
  });
});
