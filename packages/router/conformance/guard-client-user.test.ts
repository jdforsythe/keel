// @vitest-environment happy-dom
// Spec: k.guards, clause "A client router in a project with `identity.ts` beside `topology.ts`, its net answering `/__keel/user` with `'u1'`: a guard on the first and on a second navigation gets `'u1'`, after one GET; answered 500, or the fetch rejecting, `''`; a router in a project without it sends no GET and its guard gets `''`."
// k.guards, Client "A `client` deployable's router, in a project with `identity.ts` beside `topology.ts` (k.mount), sends that GET to its page's origin once before its first guard runs, and again after each mount request's answer in a shell (k.return); a guard waits for the answer in flight."
// k.guards, Client "Its guards, loaders and actions get that `user`: `''` before any answer, and after a failure or an answer other than 200."
// k.guards, Client "the router holds it in memory, never in `ctx.storage`, a log or a URL"
// k.guards, Client "A router with no `identity.ts` sends none, and `user` is `''`."
// Seed: 1337 (fc.assert below). Pending: RFC 0186 is not built. To un-skip: change `test.skip` to `test` in each skipped case once the client router reads `/__keel/user`.
// ASSUMPTION: the spec names no router option that says "its modules import identity.ts"; the cases pass `mount: mount.path` to `createRouter` (the identity mount's path, k.mount) for that. The builder amends the one `startRouter` below if the signal is another.
// ASSUMPTION: the sim net route `*` takes every request to the page's origin; a request counts as the read when its path is `/__keel/user`.
import { createCtx } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { Form, action, createRouter, guard, identityMount, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount as mountDom } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, defer, memoryHistory, settle } from "./fixtures.ts";

const mount = identityMount("/api/auth");
const Empty = s.object({});
const cc = contract("cu", {
  "cu.login": { path: "/login" },
  "cu.home": { path: "/" },
  "cu.next": { path: "/next" },
});
type Seen = { guard: string[]; loader: string[]; action: string[] };
const seen: Seen = { guard: [], loader: [], action: [] };
const reset = (): void => {
  seen.guard.length = 0;
  seen.loader.length = 0;
  seen.action.length = 0;
};
const gate = guard({ redirect: "cu.login" }, async ({ user }) => {
  seen.guard.push(user);
  return ok(null);
});
const view = (): Node => document.createElement("p");
const withForm = (): Node =>
  Form({ method: "POST", action: cc.href("cu.next"), children: () => [document.createElement("button")] });
const routes = manifest(cc, {
  "cu.login": { component: view },
  "cu.home": { component: view, guard: gate },
  "cu.next": {
    component: withForm,
    guard: gate,
    loader: loader(cc, "cu.next", { output: Empty }, async ({ user }) => {
      seen.loader.push(user);
      return ok({});
    }),
    POST: action(cc, "cu.next", { input: Empty }, async (_input, { user }) => {
      seen.action.push(user);
      return ok(null);
    }),
  },
});

type Request1 = { method: string; path: string; xKeel: string | null };
type Net = { read: Request1[]; other: Request1[] };
/** A sim ctx whose net answers the read with `answer`, recording each request. */
function world(answer: (n: number) => Response | Promise<Response>) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const net: Net = { read: [], other: [] };
  ctx.net.route("*", (req) => {
    const r = { method: req.method, path: new URL(req.url).pathname, xKeel: req.headers.get("x-keel") };
    if (r.path !== "/__keel/user") {
      net.other.push(r);
      return new Response("{}", { status: 404 });
    }
    net.read.push(r);
    return answer(net.read.length);
  });
  return { ctx, net };
}
const userIs = (user: string) => (): Response =>
  new Response(JSON.stringify({ user }), { status: 200, headers: { "content-type": "application/json" } });

function startRouter(ctx: Ctx, opts: { identity: boolean; render?: boolean } = { identity: true }) {
  const history = memoryHistory("/");
  const router = createRouter(routes, { ctx, history, ...(opts.identity ? { mount: mount.path } : {}) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = opts.render === true ? mountDom(router.App, host, { ctx }) : () => {};
  return {
    router,
    host,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
}
const users = fc.stringMatching(/^[a-z][a-z0-9]{0,11}$/);

describe("k.guards Client: a client router reads the user once before its first guard", () => {
  test("a guard on the first and on a second navigation gets `'u1'`, after one GET", async () => {
    reset();
    const { ctx, net } = world(userIs("u1"));
    const r = startRouter(ctx);
    try {
      await settle();
      await r.router.navigate(cc.href("cu.next"));
      await settle();
      expect(seen.guard).toEqual(["u1", "u1"]);
      expect(net.read).toHaveLength(1);
      expect(net.read[0]?.method).toBe("GET");
      expect(net.read[0]?.xKeel).toBe("1");
    } finally {
      r.stop();
    }
  });

  test("any user id the read answers is the `user` of the guard and the loader, after one GET", async () => {
    await fc.assert(
      fc.asyncProperty(users, async (id) => {
        reset();
        const { ctx, net } = world(userIs(id));
        const r = startRouter(ctx);
        try {
          await settle();
          await r.router.navigate(cc.href("cu.next"));
          await settle();
          expect(seen.guard).toEqual([id, id]);
          expect(seen.loader).toEqual([id]);
          expect(net.read).toHaveLength(1);
        } finally {
          r.stop();
        }
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("a submitted `Form`'s action gets that `user`", async () => {
    reset();
    const { ctx } = world(userIs("u1"));
    const r = startRouter(ctx, { identity: true, render: true });
    try {
      await settle();
      await r.router.navigate(cc.href("cu.next"));
      await settle();
      const form = r.host.querySelector("form");
      expect(form).not.toBeNull();
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await settle();
      expect(seen.action).toEqual(["u1"]);
    } finally {
      r.stop();
    }
  });

  test("answered 500, the guard gets `''`", async () => {
    reset();
    const { ctx, net } = world(() => new Response("{}", { status: 500 }));
    const r = startRouter(ctx);
    try {
      await settle();
      await expect(r.router.navigate(cc.href("cu.next"))).resolves.toBeUndefined();
      await settle();
      expect(seen.guard).toEqual(["", ""]);
      expect(seen.loader).toEqual([""]);
      expect(net.read).toHaveLength(1);
    } finally {
      r.stop();
    }
  });

  test("any answer other than 200 gives the guard `''`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(201, 204, 301, 403, 404, 500, 503), async (status) => {
        reset();
        const { ctx } = world(() => new Response(JSON.stringify({ user: "u1" }), { status }));
        const r = startRouter(ctx);
        try {
          await settle();
          expect(seen.guard).toEqual([""]);
        } finally {
          r.stop();
        }
      }),
      { seed: SEED, numRuns: 7 },
    );
  });

  test("the fetch rejecting, the guard gets `''`", async () => {
    reset();
    const { ctx } = world(userIs("u1"));
    ctx.net.setOnline(false);
    const r = startRouter(ctx);
    try {
      await settle();
      await expect(r.router.navigate(cc.href("cu.next"))).resolves.toBeUndefined();
      expect(seen.guard).toEqual(["", ""]);
    } finally {
      r.stop();
    }
  });

  test("a router in a project without it sends no GET and its guard gets `''`", async () => {
    reset();
    const { ctx, net } = world(userIs("u1"));
    const r = startRouter(ctx, { identity: false, render: true });
    try {
      await settle();
      await r.router.navigate(cc.href("cu.next"));
      await settle();
      expect(net.read).toEqual([]);
      expect(net.other).toEqual([]);
      expect(seen.guard).toEqual(["", ""]);
      expect(seen.loader).toEqual([""]);
    } finally {
      r.stop();
    }
  });

  test("a guard that runs while the read is in flight waits for its answer", async () => {
    reset();
    const gateOpen = defer();
    const { ctx } = world(async () => {
      await gateOpen.promise;
      return userIs("u1")();
    });
    const r = startRouter(ctx);
    try {
      await settle();
      expect(seen.guard).toEqual([]);
      gateOpen.resolve();
      await settle();
      expect(seen.guard).toEqual(["u1"]);
    } finally {
      r.stop();
    }
  });

  test("the router keeps the user in memory only: nothing reaches `ctx.storage`, `document.cookie` or web storage", async () => {
    reset();
    const { ctx } = world(userIs("u1"));
    const writes: string[] = [];
    const recorder = {
      get: (key: string) => ctx.storage.get(key),
      read: (keys: readonly string[]) => ctx.storage.read(keys),
      set: (key: string, value: string) => {
        writes.push(`${key}=${value}`);
        return ctx.storage.set(key, value);
      },
      commit: (w: Parameters<typeof ctx.storage.commit>[0]) => {
        for (const x of w) if (x.value !== undefined) writes.push(`${x.key}=${x.value}`);
        return ctx.storage.commit(w);
      },
    };
    const watched = new Proxy(ctx, { get: (t, k) => (k === "storage" ? recorder : Reflect.get(t, k, t)) });
    const r = startRouter(watched);
    try {
      await settle();
      await r.router.navigate(cc.href("cu.next"));
      await settle();
      expect(seen.guard).toEqual(["u1", "u1"]);
      expect(writes).toEqual([]);
      expect(document.cookie).toBe("");
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    } finally {
      r.stop();
    }
  });
});
