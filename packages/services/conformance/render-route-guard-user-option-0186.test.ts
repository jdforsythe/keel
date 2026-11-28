// @vitest-environment happy-dom
// Spec: k.guards, clause "`renderRoute(id, { routes, user: 'u1' })` over a module importing `identity.ts`: its guard gets `'u1'` and no `/__keel/user` GET is sent."
// k.guards, Client "Under `renderRoute` its `user` option stands for the answer, and no GET is sent."
// k.guards, Client "A router with no `identity.ts` sends none, and `user` is `''`."
// Seed: 1337 (fc.assert below). Pending: RFC 0186 is not built. To un-skip: change `test.skip` to `test` once the client router's read exists and `renderRoute` leaves it unsent under `user`; the no-GET assertion of the first case already holds, so the case can run live when `user` already reaches the guard.
// ASSUMPTION: the route `*` on the ctx's net takes every request to the page's origin. Fixture: render-route-guard-user-support.ts.
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, cc, reset, rec, routes } from "./render-route-guard-user-support.ts";

const users = fc.stringMatching(/^[a-z][a-z0-9]{0,11}$/);
function sim() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const paths: string[] = [];
  ctx.net.route("*", (req) => {
    paths.push(new URL(req.url).pathname);
    return new Response("{}", { status: 404 });
  });
  return { ctx, paths };
}

test("`renderRoute(id, { routes, user })` over a module importing `identity.ts`: its guard and loader get `user` and no `/__keel/user` GET is sent", async () => {
  await fc.assert(
    fc.asyncProperty(users, async (user) => {
      reset();
      const { ctx, paths } = sim();
      const h = await renderRoute("cg.page", { routes, ctx, user });
      try {
        expect(h.route().id).toBe("cg.page");
        expect(rec.guard).toEqual([user]);
        expect(rec.loader).toEqual([user]);
        expect(paths).not.toContain("/__keel/user");
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("`renderRoute(id, { routes, user: 'u1' })` sends no `/__keel/user` GET after a navigation either", async () => {
  reset();
  const { ctx, paths } = sim();
  const h = await renderRoute("cg.page", { routes, ctx, user: "u1" });
  try {
    await h.navigate(cc.href("cg.signin"));
    await h.navigate(cc.href("cg.page"));
    expect(paths.filter((p) => p === "/__keel/user")).toEqual([]);
    expect(rec.guard.every((u) => u === "u1")).toBe(true);
  } finally {
    h.dispose();
  }
});
