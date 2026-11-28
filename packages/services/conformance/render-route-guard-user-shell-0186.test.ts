// @vitest-environment happy-dom
// Spec: k.guards, clause "Under `renderRoute(id, { routes, shell: true, ctx })`, the origin routed to a `createApp` whose `handle` answers a mount `Form` POST 303 to a page guarded by `user !== ''` with `set-cookie: s=1`, and whose `identify` answers `'u1'` for `s=1`: a second `/__keel/user` GET carries `s=1`, and the page renders without a redirect."
// k.guards, Client "again after each mount request's answer in a shell (k.return)"
// k.return, Mount requests "the router reads `user` again (k.guards Client) before it acts on them."
// k.guards, Client "the router holds it in memory, never in `ctx.storage`, a log or a URL"
// Seed: 1337 (no generated input). Pending: RFC 0186 is not built. To un-skip: change `test.skip` to `test` in each case once the client router reads `/__keel/user` and re-reads it after a mount answer in a shell.
// ASSUMPTION: the route `*` on the shell ctx's net takes every request to the page's origin; the request's `cookie` is read as it reaches that route. Fixture: render-route-guard-user-support.ts.
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { SEED, boot, mount, reset, rec, routes } from "./render-route-guard-user-support.ts";

type Seen = { method: string; path: string; cookie: string | null; url: string };
async function shell() {
  reset();
  const { app } = await boot();
  const seen: Seen[] = [];
  const ctx = createCtx({ mode: "sim", seed: SEED });
  ctx.net.route("*", (req) => {
    seen.push({ method: req.method, path: new URL(req.url).pathname, cookie: req.headers.get("cookie"), url: req.url });
    return app.fetch(req);
  });
  const h = await renderRoute("cg.signin", { routes, shell: true, ctx, mount });
  return { h, seen };
}
const reads = (seen: Seen[]) => seen.filter((r) => r.path === "/__keel/user");
const holds = (cookie: string | null) => cookie !== null && cookie.split(/;\s*/).includes("s=1");

test("a mount `Form` POST answered 303 to a page guarded by `user !== ''` with `set-cookie: s=1`: a second `/__keel/user` GET carries `s=1`, and the page renders without a redirect", async () => {
  const { h, seen } = await shell();
  try {
    expect(reads(seen)).toHaveLength(1);
    expect(holds(reads(seen)[0]?.cookie ?? null)).toBe(false);
    await h.fire("cg.signin.go", { type: "click" });
    expect(seen.find((r) => r.method === "POST")?.path).toBe("/api/auth/in");
    expect(reads(seen)).toHaveLength(2);
    expect(holds(reads(seen)[1]?.cookie ?? null)).toBe(true);
    expect(h.route().id).toBe("cg.page");
    expect(rec.guard.at(-1)).toBe("u1");
    expect(rec.loader.at(-1)).toBe("u1");
  } finally {
    h.dispose();
  }
});

test("the read after the mount answer comes before the router acts on its `location`: the guard never saw `''` after the POST", async () => {
  const { h, seen } = await shell();
  try {
    await h.fire("cg.signin.go", { type: "click" });
    expect(rec.guard).not.toContain("");
    expect(seen.map((r) => r.path).filter((p) => p === "/__keel/user" || p === "/api/auth/in")).toEqual([
      "/__keel/user",
      "/api/auth/in",
      "/__keel/user",
    ]);
  } finally {
    h.dispose();
  }
});

test("after a sign-out mount answer the read runs again, carries no `s=1`, and the guard gets `''`", async () => {
  const { h, seen } = await shell();
  try {
    await h.fire("cg.signin.go", { type: "click" });
    expect(h.route().id).toBe("cg.page");
    await h.fire("cg.signout", { type: "click" });
    expect(reads(seen)).toHaveLength(3);
    expect(holds(reads(seen)[2]?.cookie ?? null)).toBe(false);
    expect(h.route().id).toBe("cg.signin");
  } finally {
    h.dispose();
  }
});

test("the user stays out of every URL the page requested", async () => {
  const { h, seen } = await shell();
  try {
    await h.fire("cg.signin.go", { type: "click" });
    for (const r of seen) expect(r.url).not.toContain("u1");
  } finally {
    h.dispose();
  }
});
