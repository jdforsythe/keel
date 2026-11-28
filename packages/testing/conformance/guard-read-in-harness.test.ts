// @vitest-environment happy-dom
// Spec: k.guards, clause "`renderRoute(id, { routes, ctx, mount })`, `mount` the result of `identityMount('/auth')`, of a page with no guard and no loader, no `user`, and no route for `/__keel/user` on the sim `ctx`: `requests()` is exactly `[{ method: 'GET', url: new URL('/__keel/user', location.href).href, headers: ['accept', 'x-keel'] }]`, and after a `navigate` to a second page it is still that one entry; with `user: 'u1'` added it is `[]`; without `mount`, in the same test file, it is `[]`; a guard on the page gets `''` in each case but `user: 'u1'`. The two halves are read on two pages opened the same way: the request log on a page with no guard, the guard's `user` on a page with one."
// k.guards, Client "A `renderRoute` router reads only when its test names the identity mount: the `mount` option, the default export of `identity.ts` that the test file imports (`import mount from '../identity.ts'`), as the built entry imports it and passes it to `createRouter`. With `mount` and without `user` it sends the GET as a built one does, its own `mount` (k.mount-scope) that mount's `path`; without `mount` it sends none, whatever the test's modules import."
// k.guards, Client "`renderRoute`'s `mount` is the identity mount the harness's router and shell take, as a built entry passes it: the router reads `user` with it and matches no page under it (k.mount-scope), and a shell sends mount requests under it (k.return). Without it the harness has none, as a build of a project with no `identity.ts`. A Conformance clause of any section whose harness uses an identity mount passes it as `mount`, written or not."
// Seed 1337 (fc.assert below). One file holds both halves: `identityMount('/auth')` runs at module scope and is passed as `mount` where a case names it; the cases without `mount` run in this same file, so the module graph holds an identity mount that they must not take.
// ASSUMPTION: the clause says "a page with no guard" and "a guard on the page"; the log is read on a guardless page and the guard on a second, guarded page opened the same way.
import { createCtx } from "@keel/ctx";
import { guard, identityMount, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const mount = identityMount("/auth");

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

describe("k.guards: the read in a harness, with and without the identity mount named", () => {
  it("renderRoute(id, { routes, ctx, mount }) of a guardless page with no user and no route for /__keel/user: requests() is exactly the one GET with ['accept', 'x-keel'], and still that entry after a navigate to a second page", async () => {
    const h = await renderRoute("gr.one", { routes, ctx: sim(), mount });
    await h.settle();
    expect(h.requests()).toEqual([READ]);
    await h.navigate(rc.href("gr.two"));
    expect(h.route().id).toBe("gr.two");
    expect(h.requests()).toEqual([READ]);
    h.dispose();
  });

  it("with user: 'u1' added requests() is [] and the guard gets 'u1'", async () => {
    seen.length = 0;
    const h = await renderRoute("gr.guarded", { routes, ctx: sim(), mount, user: "u1" });
    await h.settle();
    expect(h.requests()).toEqual([]);
    expect(seen).toEqual(["u1"]);
    h.dispose();
  });

  it("without mount, in the same test file, requests() is [] before and after a navigate, though the file made an identity mount", async () => {
    const h = await renderRoute("gr.one", { routes, ctx: sim() });
    await h.settle();
    expect(h.requests()).toEqual([]);
    await h.navigate(rc.href("gr.two"));
    expect(h.requests()).toEqual([]);
    h.dispose();
  });

  it("a guard on the page gets '' with mount and no user, and '' without mount", async () => {
    seen.length = 0;
    const withMount = await renderRoute("gr.guarded", { routes, ctx: sim(), mount });
    await withMount.settle();
    expect(withMount.requests()).toEqual([READ]);
    withMount.dispose();
    const without = await renderRoute("gr.guarded", { routes, ctx: sim() });
    await without.settle();
    expect(without.requests()).toEqual([]);
    without.dispose();
    expect(seen).toEqual(["", ""]);
  });

  it("for any number of handles each on its own ctx, with mount each log is exactly the one read and without mount each is []", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), fc.boolean(), async (n, named) => {
        for (let i = 0; i < n; i++) {
          const h = await renderRoute("gr.one", { routes, ctx: sim(), ...(named ? { mount } : {}) });
          await h.settle();
          expect(h.requests()).toEqual(named ? [READ] : []);
          h.dispose();
        }
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("an answer the net gives the read (a route answering 'u1') reaches the guard with mount, and never without it", async () => {
    seen.length = 0;
    const named = sim();
    named.net.route(READ.url, () => Response.json({ user: "u1" }));
    const h = await renderRoute("gr.guarded", { routes, ctx: named, mount });
    await h.settle();
    expect(seen).toEqual(["u1"]);
    expect(h.requests()).toEqual([READ]);
    h.dispose();
    seen.length = 0;
    const bare = sim();
    bare.net.route(READ.url, () => Response.json({ user: "u1" }));
    const g = await renderRoute("gr.guarded", { routes, ctx: bare });
    await g.settle();
    expect(seen).toEqual([""]);
    expect(g.requests()).toEqual([]);
    g.dispose();
  });

  it("for any identity mount path passed as mount, the harness sends the one read", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), async (seg) => {
        const own = identityMount(`/${seg}`);
        const h = await renderRoute("gr.one", { routes, ctx: sim(), mount: own });
        await h.settle();
        expect(h.requests()).toEqual([READ]);
        h.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
