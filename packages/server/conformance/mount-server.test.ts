// Spec: k.mount, Server "A native POST under `handle.path` meets the same-site check first (k.server): same-origin passes; cross-site is 403 `keel.denied`, `fn` not called. Keel sets no cookie on a `handle` response. `form-action 'self'` (k.security) admits the post and a same-origin 303; browsers that apply it to redirects block a form post redirected to another origin, so leaving for a provider starts from a `Link` (a GET), whose redirect no directive governs."
// Spec: k.mount, Form "The app's `handle.fn` answers a form post with a 303 to a page `Href` carrying its library's `set-cookie`; a rejection redirects to the form's page with a search key that route's schema declares (`?error=credentials`), which the page reads. Keel reads neither. The submitted email or password never goes back into a URL."
// Spec: k.mount, Form "`.pii()` and `s.secret` fields go in the body as typed, to the page's own origin only; Keel logs no body. A URL lands in history and access logs, so none goes in `search`."
// Spec: k.mount, Declaration "`identity.server.ts` then gives `handle: { path: <its default import>.path, fn }`."
// Spec: k.mount, Conformance "A same-origin urlencoded POST under `handle.path` reaches `fn`, a cross-site one is 403 without it; no response sets a cookie `fn` did not."
// Seed 1337 (fc.assert below). Runs under plain Node: happy-dom strips cookie headers.
// Not testable here: that browsers which apply `form-action` to redirects block a form post answered by a redirect to another origin (a browser smoke).
// Not stated by the spec and so not asserted: that an action cannot set response headers.
// @vitest-environment node
import { identityMount } from "@keel/router";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { BASE, SEED, cookieOf, rig } from "./identity-support.ts";
import type { Handler } from "./identity-support.ts";

const mount = identityMount("/api/auth");
const FORM = "application/x-www-form-urlencoded";
const SAME_SITE = { "content-type": FORM, "sec-fetch-site": "same-origin", origin: BASE, accept: "text/html" };
const CROSS_SITE = { "content-type": FORM, "sec-fetch-site": "cross-site", origin: "http://evil.example" };
const names = (res: Response): string[] => res.headers.getSetCookie().map((c) => c.split("=")[0] ?? "");

function library(answer: () => Response = () => new Response(null, { status: 204 })) {
  const calls: { method: string; path: string; type: string; body: string }[] = [];
  const fn: Handler = async (request) => {
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname,
      type: request.headers.get("content-type") ?? "",
      body: await request.text(),
    });
    return answer();
  };
  return { calls, handle: { path: mount.path, fn } };
}

const signedIn = (): Response => {
  const headers = new Headers({ location: "/orders" });
  headers.append("set-cookie", "sid=abc; Path=/; HttpOnly; Max-Age=3600");
  return new Response(null, { status: 303, headers });
};

const post = (r: Awaited<ReturnType<typeof rig>>, path: string, body: string, headers: Record<string, string>) =>
  r.app.fetch(new Request(`${BASE}${path}`, { method: "POST", body, headers }));

describe("k.mount: a form post under the mount", () => {
  test("a same-origin urlencoded POST under `handle.path` reaches `fn` with the fields as sent, for generated fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.stringMatching(/^[a-z]{1,6}$/), fc.string({ maxLength: 12 }), { minKeys: 1, maxKeys: 4 }),
        fc.constantFrom({ "sec-fetch-site": "same-origin" }, { origin: BASE }, { "sec-fetch-site": "none" }),
        async (fields, proof) => {
          const lib = library();
          const r = await rig({ identify: async () => "u1", handle: lib.handle });
          const body = new URLSearchParams(fields).toString();
          const res = await post(r, "/api/auth/sign-in/email", body, { "content-type": FORM, ...proof });
          expect(res.status).toBe(204);
          expect(lib.calls).toEqual([{ method: "POST", path: "/api/auth/sign-in/email", type: FORM, body }]);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a POST at the mount path itself and under it reaches `fn`, and `handle.path` is the mount's `path`", async () => {
    const lib = library();
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    expect(lib.handle.path).toBe(mount.path);
    for (const path of [mount.href(), mount.href("/sign-out"), mount.href("/callback/github", { code: "x y" })]) {
      expect((await post(r, path, "a=1", SAME_SITE)).status).toBe(204);
    }
    expect(lib.calls.map((c) => c.path)).toEqual(["/api/auth", "/api/auth/sign-out", "/api/auth/callback/github"]);
  });

  test("a 303 from `fn` with its library's `set-cookie` reaches the browser as given, with k.security's headers added", async () => {
    const lib = library(signedIn);
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    const res = await post(r, "/api/auth/sign-in/email", "email=a%40b.example&password=pw", SAME_SITE);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/orders");
    expect(res.headers.getSetCookie()).toEqual(["sid=abc; Path=/; HttpOnly; Max-Age=3600"]);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  test("a rejection redirect to the form's page with a search key reaches the browser as given and Keel reads neither answer", async () => {
    const lib = library(() => new Response(null, { status: 303, headers: { location: "/sign-in?error=credentials" } }));
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    const res = await post(r, "/api/auth/sign-in/email", "email=a%40b.example&password=pw", SAME_SITE);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/sign-in?error=credentials");
    expect(res.headers.get("location")).not.toContain("pw");
    expect(res.headers.get("location")).not.toContain("a%40b");
  });

  test("a cross-site POST under `handle.path` is 403 `keel.denied` and `fn` is not called", async () => {
    const lib = library(signedIn);
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    for (const path of ["/api/auth", "/api/auth/sign-in/email", "/api/auth/sign-out"]) {
      const res = await post(r, path, "email=a%40b.example&password=pw", { ...CROSS_SITE, accept: "application/json" });
      expect(res.status).toBe(403);
      expect(JSON.stringify(await res.json())).toContain("keel.denied");
      expect(res.headers.getSetCookie().some((c) => c.startsWith("sid="))).toBe(false);
    }
    expect((await post(r, "/api/auth/sign-in/email", "a=1", CROSS_SITE)).status).toBe(403);
    expect(lib.calls).toEqual([]);
  });

  test("a GET to the mount from a link reaches `fn`, whose redirect to another origin is returned as given", async () => {
    const lib = library(
      () => new Response(null, { status: 302, headers: { location: "https://provider.example/authorize" } }),
    );
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    const res = await r.get(mount.href("/login/github"), { accept: "text/html", "sec-fetch-site": "same-origin" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://provider.example/authorize");
    expect(lib.calls.map((c) => c.method)).toEqual(["GET"]);
  });
});

describe("k.mount: Keel sets no cookie on a handle response", () => {
  test("across a document GET, an action POST and the mount POST, no cookie but `fn`'s and the caller cookie appears", async () => {
    const lib = library(signedIn);
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    const page = await r.get("/login", { accept: "text/html" });
    const act = await r.post("/who", {}, { "sec-fetch-site": "same-origin" });
    const mounted = await post(r, "/api/auth/sign-in/email", "a=1", SAME_SITE);
    for (const res of [page, act]) for (const n of names(res)) expect(n).toBe("keel-caller");
    expect(names(mounted)).toEqual(["sid"]);
    expect(cookieOf(mounted, "keel-caller")).toBeUndefined();
    expect(page.headers.getSetCookie().some((c) => c.startsWith("sid="))).toBe(false);
    expect(act.headers.getSetCookie().some((c) => c.startsWith("sid="))).toBe(false);
  });

  test("a `fn` that answers with no cookie leaves the mount response with none, even for a caller with no cookie", async () => {
    const lib = library(() => new Response(null, { status: 303, headers: { location: "/sign-in?error=credentials" } }));
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    const res = await post(r, "/api/auth/sign-in/email", "a=1", SAME_SITE);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe("k.mount: form-action 'self' admits the post, and nothing wider", () => {
  test("a document carries `form-action 'self'` and no other `form-action` source", async () => {
    const lib = library();
    const r = await rig({ identify: async () => "u1", handle: lib.handle });
    const res = await r.get("/login", { accept: "text/html" });
    const directives = (res.headers.get("content-security-policy") ?? "").split(";").map((d) => d.trim());
    expect(directives.filter((d) => d.startsWith("form-action"))).toEqual(["form-action 'self'"]);
  });
});

describe("k.mount: Keel logs no body", () => {
  test("a posted password and email appear in no log line, whatever they hold", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z0-9]{8,16}$/),
        fc.stringMatching(/^[a-z0-9]{8,16}$/),
        async (pw, mail) => {
          const lib = library(signedIn);
          const r = await rig({ identify: async () => "u1", handle: lib.handle, log: true });
          const body = new URLSearchParams({ email: `${mail}@b.example`, password: pw }).toString();
          await post(r, "/api/auth/sign-in/email", body, SAME_SITE);
          expect(lib.calls).toHaveLength(1);
          for (const line of r.lines) {
            expect(line).not.toContain(pw);
            expect(line).not.toContain(mail);
          }
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });
});
