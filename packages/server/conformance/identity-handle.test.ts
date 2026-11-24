// Spec: k.user, Identity source "`handle: { path, fn }`: a request at `path` or under it goes to `fn(request, ctx, { routes })` with its body (`maxBodyBytes`), `routes` the deployable's route table, so a `next` it carries becomes a 303 `location` through `pageHref` (k.router Return targets), after the same-site check for a write; its `Response`, `set-cookie` included, is returned with k.security's headers added. An auth library's endpoints live here."
// Spec: k.user, Conformance "With `identify` and a `handle` whose `fn` sets `sid`, no response but `fn`'s sets a cookie other than the caller cookie; `fn`'s `set-cookie` reaches the client; a cross-site POST under `handle.path` is 403 and `fn` is not called."
// Spec: k.user, intro "Keel authenticates no one: it carries what a function the app supplies answers, and never reads, writes, mints, rotates or stores a credential, session or token for it."
// Seed 1337 (fc.assert below). Runs under plain Node: happy-dom strips cookie headers.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, cookieOf, rig } from "./identity-support.ts";
import type { Handler } from "./identity-support.ts";

const names = (res: Response): string[] => res.headers.getSetCookie().map((c) => c.split("=")[0] ?? "");

function mount(extra: Partial<Record<string, string>> = {}) {
  const calls: { method: string; path: string; body: string }[] = [];
  const fn: Handler = async (request) => {
    calls.push({ method: request.method, path: new URL(request.url).pathname, body: await request.text() });
    const headers = new Headers({ "content-type": "text/plain", "x-from-fn": "1", ...extra });
    headers.append("set-cookie", "sid=abc; Path=/; HttpOnly; Max-Age=3600");
    return new Response("from fn", { status: 201, headers });
  };
  return { calls, handle: { path: "/auth", fn } };
}

describe("k.user: handle", () => {
  test("With `identify` and a `handle` whose `fn` sets `sid`, `fn`'s `set-cookie` reaches the client and its status, body and headers are returned as given", async () => {
    const m = mount();
    const r = await rig({ identify: async () => "u1", handle: m.handle });
    const res = await r.get("/auth/sign-in", { accept: "*/*" });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("from fn");
    expect(res.headers.get("x-from-fn")).toBe("1");
    expect(res.headers.getSetCookie()).toEqual(["sid=abc; Path=/; HttpOnly; Max-Age=3600"]);
  });

  test("a request at `path` or under it goes to `fn(request, ctx, { routes })` with its body, after the same-site check for a write", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 3 }),
        fc.string({ maxLength: 40 }),
        async (segments, body) => {
          const m = mount();
          const r = await rig({ identify: async () => "u1", handle: m.handle });
          const path = ["/auth", ...segments].join("/");
          const res = await r.post(path, body, { "content-type": "text/plain" });
          expect(res.status).toBe(201);
          expect(m.calls).toEqual([{ method: "POST", path, body }]);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a cross-site POST under `handle.path` is 403 and `fn` is not called", async () => {
    const m = mount();
    const r = await rig({ identify: async () => "u1", handle: m.handle });
    for (const path of ["/auth", "/auth/callback"]) {
      const res = await r.post(path, "{}", { origin: "http://evil.example", "sec-fetch-site": "cross-site" });
      expect(res.status).toBe(403);
    }
    expect(m.calls).toEqual([]);
    expect((await r.get("/auth/callback", { "sec-fetch-site": "cross-site" })).status).toBe(201);
    expect(m.calls).toHaveLength(1);
  });

  test("a request under `handle.path` does not call `identify`, and no guard, loader or action runs", async () => {
    const m = mount();
    const r = await rig({ identify: async () => "u1", handle: m.handle });
    await r.get("/auth/sign-in");
    await r.post("/auth/sign-out", {});
    expect(r.identified).toHaveLength(0);
    expect(r.seen.order).toEqual([]);
  });

  test("k.security's headers are added to `fn`'s response", async () => {
    const m = mount();
    const r = await rig({ identify: async () => "u1", handle: m.handle });
    const res = await r.get("/auth/x");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
  });

  test("a body over `maxBodyBytes` under `handle.path` is 413 and `fn` is not called", async () => {
    const m = mount();
    const r = await rig({ identify: async () => "u1", handle: m.handle, maxBodyBytes: 64 });
    const res = await r.post("/auth/x", "x".repeat(65), { "content-type": "text/plain" });
    expect(res.status).toBe(413);
    expect(m.calls).toEqual([]);
  });

  test("no response but `fn`'s sets a cookie other than the caller cookie, across a GET, a write and an event stream to routes", async () => {
    const m = mount();
    const r = await rig({ identify: async () => "u1", handle: m.handle });
    const ac = new AbortController();
    const responses = [
      await r.get("/who"),
      await r.post("/who"),
      await r.get("/api/who"),
      await r.stream("/api/live", ac.signal),
      await r.get("/login"),
    ];
    ac.abort();
    for (const res of responses) for (const n of names(res)) expect(n).toBe("keel-caller");
    const minted = cookieOf(responses[1] ?? new Response(), "keel-caller");
    expect(minted).toBeDefined();
    expect(minted).not.toMatch(/max-age|expires/i);
    expect(responses.flatMap((x) => x.headers.getSetCookie()).some((c) => c.includes("sid="))).toBe(false);
  });

  test("an identity that answers a user id never makes the kernel write a cookie for it", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{3,20}$/), async (id) => {
        const r = await rig({ identify: async () => `usr~${id}~` });
        const res = await r.post("/who");
        for (const c of res.headers.getSetCookie()) {
          expect(c.startsWith("keel-caller=")).toBe(true);
          expect(c).not.toContain("usr~");
        }
        expect((await r.get("/who")).headers.getSetCookie()).toEqual([]);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
