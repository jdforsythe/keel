// @vitest-environment happy-dom
// Spec: k.guards (rfc:0209), Conformance "In a test file that calls `identityMount('/auth')` before the harness opens, `renderRoute(id, { routes, ctx })` of a page with no guard and no loader, no `user`, and no route for `/__keel/user` on the sim `ctx`: `requests()` is exactly `[{ method: 'GET', url: new URL('/__keel/user', location.href).href, headers: ['accept', 'x-keel'] }]`, and after a `navigate` to a second page it is still that one entry; with `user: 'u1'` it is `[]`; in a test file that makes no identity mount, it is `[]`, and a guard on the page gets `''` in each case but `user: 'u1'`."
// Spec: k.guards (rfc:0209), Client "Without `user` and without `app`, a `renderRoute` router reads as a built one: it sends the GET when an identity mount (`identityMount`, k.mount) was made in the test file's module graph, its `mount` (k.mount-scope) the `path` of the first one made, and sends none when none was."
// Seed 1337 (fc.assert below). This file makes no identity mount and imports no module that does: the module graph of one test file holds none (the case with a mount is guard-read-in-harness.test.ts).
// ASSUMPTION: the clause says "a page with no guard" and "a guard on the page"; the log is read on a guardless page and the guard on a second, guarded page opened the same way.
import { createCtx } from "@keel/ctx";
import { guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const p = (): HTMLElement => document.createElement("p");
const seen: string[] = [];
const rc = contract("gn", { "gn.one": { path: "/" }, "gn.two": { path: "/two" }, "gn.guarded": { path: "/guarded" } });
const routes = manifest(rc, {
  "gn.one": { component: p },
  "gn.two": { component: p },
  "gn.guarded": {
    component: p,
    guard: guard({ redirect: "gn.one" }, async ({ user }) => {
      seen.push(user);
      return ok(null);
    }),
  },
});
const sim = () => createCtx({ mode: "sim", seed: SEED });

describe("k.guards: the read in a harness, with no identity mount made", () => {
  it("renderRoute of a guardless page with no user: requests() is [] before and after a navigate to a second page", async () => {
    const h = await renderRoute("gn.one", { routes, ctx: sim() });
    await h.settle();
    expect(h.requests()).toEqual([]);
    await h.navigate(rc.href("gn.two"));
    expect(h.requests()).toEqual([]);
    h.dispose();
  });

  it("a guard on the page gets '' and requests() is []", async () => {
    seen.length = 0;
    const h = await renderRoute("gn.guarded", { routes, ctx: sim() });
    await h.settle();
    expect(seen).toEqual([""]);
    expect(h.requests()).toEqual([]);
    h.dispose();
  });

  it("for any number of handles, none sends a /__keel/user request", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
        for (let i = 0; i < n; i++) {
          const h = await renderRoute("gn.one", { routes, ctx: sim() });
          await h.settle();
          expect(h.requests().filter((e) => e.url.includes("/__keel/"))).toEqual([]);
          h.dispose();
        }
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
