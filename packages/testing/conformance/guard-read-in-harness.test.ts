// @vitest-environment happy-dom
// Spec: k.guards (rfc:0209), Conformance "In a test file that calls `identityMount('/auth')` before the harness opens, `renderRoute(id, { routes, ctx })` of a page with no guard and no loader, no `user`, and no route for `/__keel/user` on the sim `ctx`: `requests()` is exactly `[{ method: 'GET', url: new URL('/__keel/user', location.href).href, headers: ['accept', 'x-keel'] }]`, and after a `navigate` to a second page it is still that one entry; with `user: 'u1'` it is `[]`; in a test file that makes no identity mount, it is `[]`, and a guard on the page gets `''` in each case but `user: 'u1'`."
// Spec: k.guards (rfc:0209), Client "Without `user` and without `app`, a `renderRoute` router reads as a built one: it sends the GET when an identity mount (`identityMount`, k.mount) was made in the test file's module graph, its `mount` (k.mount-scope) the `path` of the first one made, and sends none when none was."
// Seed 1337 (fc.assert below). This file makes an identity mount at module scope; the case of a file that makes none is guard-read-in-harness-none.test.ts (one file per module graph).
// ASSUMPTION: the clause says "a page with no guard" and "a guard on the page"; the log is read on a guardless page and the guard on a second, guarded page opened the same way.
import { createCtx } from "@keel/ctx";
import { guard, identityMount, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

identityMount("/auth");

const SEED = 1337;
const READ = { method: "GET", url: new URL("/__keel/user", location.href).href, headers: ["accept", "x-keel"] };
const p = (): HTMLElement => document.createElement("p");
const seen: string[] = [];
const rc = contract("gr", { "gr.one": { path: "/" }, "gr.two": { path: "/two" }, "gr.guarded": { path: "/guarded" } });
const routes = manifest(rc, {
  "gr.one": { component: p },
  "gr.two": { component: p },
  "gr.guarded": {
    component: p,
    guard: guard({ redirect: "gr.one" }, async ({ user }) => {
      seen.push(user);
      return ok(null);
    }),
  },
});
const sim = () => createCtx({ mode: "sim", seed: SEED });

describe("k.guards: the read in a harness, with an identity mount made", () => {
  it("renderRoute of a guardless page with no user and no route for /__keel/user: requests() is exactly the one GET with ['accept', 'x-keel'], and still that entry after a navigate to a second page", async () => {
    const h = await renderRoute("gr.one", { routes, ctx: sim() });
    await h.settle();
    expect(h.requests()).toEqual([READ]);
    await h.navigate(rc.href("gr.two"));
    expect(h.route().id).toBe("gr.two");
    expect(h.requests()).toEqual([READ]);
    h.dispose();
  });

  it("with user: 'u1' requests() is [] and the guard gets 'u1'", async () => {
    seen.length = 0;
    const h = await renderRoute("gr.guarded", { routes, ctx: sim(), user: "u1" });
    await h.settle();
    expect(h.requests()).toEqual([]);
    expect(seen).toEqual(["u1"]);
    h.dispose();
  });

  it("with no user the guard on the page gets '' and the one read is sent", async () => {
    seen.length = 0;
    const h = await renderRoute("gr.guarded", { routes, ctx: sim() });
    await h.settle();
    expect(seen).toEqual([""]);
    expect(h.requests()).toEqual([READ]);
    h.dispose();
  });

  it("for any number of renderRoute handles each on its own ctx, each log is exactly the one read", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
        for (let i = 0; i < n; i++) {
          const h = await renderRoute("gr.one", { routes, ctx: sim() });
          await h.settle();
          expect(h.requests()).toEqual([READ]);
          h.dispose();
        }
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("an answer the net gives the read (a route answering 'u1') reaches the guard", async () => {
    seen.length = 0;
    const ctx = sim();
    ctx.net.route(READ.url, () => Response.json({ user: "u1" }));
    const h = await renderRoute("gr.guarded", { routes, ctx });
    await h.settle();
    expect(seen).toEqual(["u1"]);
    expect(h.requests()).toEqual([READ]);
    h.dispose();
  });
});
