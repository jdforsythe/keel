// @vitest-environment happy-dom
// k.router Links, k.server Request flow: a page action's returned link is followed only when it is an `Href`, on
// every transport. The same route table runs under `createApp` (a document POST, and a runtime JSON POST) and under the
// client router (`renderRoute`, a `Form` submit). A link built without `href`, as hostile or buggy app code could,
// is 500 `keel.unexpected` on the server with no `location` and no echo, saves nothing, and in the client navigates
// nowhere: the Form's `error` slot shows `keel.unexpected`, the history and the page stay. Seed 1337.
import { createCtx } from "@keel/ctx";
import { Form, type Href, action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const BASE = "http://localhost";
const KEY = "keel.store.lo.count";
const slipped = (v: string): v is Href => v.length >= 0;
const raw = (v: string): Href => {
  if (!slipped(v)) throw new Error("unreachable");
  return v;
};
const c = contract("lo", {
  "lo.page": { path: "/lo" },
  "lo.item": { path: "/lo/item/:slug", params: s.object({ slug: s.string() }) },
});
let next: string | null = null;
const factory = () => {
  const count = store(s.object({ n: s.int() }), { n: 0 }, { id: "lo.count" });
  const bump = transaction(count, "lo.bump", s.object({}), (st) => ({ n: st.n + 1 }));
  return { count, bump };
};
const post = action(c, "lo.page", { input: s.object({}), stores: factory }, (_, { stores }) => {
  tx(stores.bump, {});
  return ok(next === null ? null : raw(next));
});
const page = (): Node => {
  const main = document.createElement("main");
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Go";
  const form = Form({
    method: "POST",
    action: c.href("lo.page"),
    error: (e) => {
      const p = document.createElement("p");
      p.id = "lo.err";
      p.textContent = e.code;
      return p;
    },
    children: () => [button],
  });
  form.id = "lo.form";
  main.append(form);
  return main;
};
const routes = manifest(c, {
  "lo.page": { component: page, POST: post },
  "lo.item": { component: () => document.createElement("main") },
});
const HOSTILE = [
  "//evil.example/x",
  "/\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0001b",
  "/a\u0085b",
];

const serve = async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const app = await createApp({
    topology: topology({ web: { modules: ["lo"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { app, ctx };
};
const documentPost = () => new Request(`${BASE}/lo`, { method: "POST", body: new FormData() });
const jsonPost = () =>
  new Request(`${BASE}/lo`, {
    method: "POST",
    body: "{}",
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
  });
const onOrigin = (url: string): boolean => {
  const u = new URL(url, BASE);
  return u.origin === BASE && url.startsWith("/") && !url.startsWith("//");
};

/** Submit the page's Form in the client router with `link` returned: what it shows, records and saves. */
const submitInClient = async (link: string | null) => {
  next = link;
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const h = await renderRoute("lo.page", { routes, ctx });
  const before = h.location().entries;
  await h.fire("lo.form", { type: "submit" }).catch(() => undefined);
  const shown = document.getElementById("lo.err")?.textContent ?? null;
  const out = {
    route: String(h.route().id),
    documents: h.documents(),
    pushed: h.location().entries - before,
    shown,
    saved: await ctx.storage.get(KEY),
  };
  h.dispose();
  return out;
};

describe("an action's link that is no Href", () => {
  it("a document POST answers 500 `keel.unexpected` with no `location` and saves nothing", async () => {
    for (const to of HOSTILE) {
      next = to;
      const { app, ctx } = await serve();
      const res = await app.fetch(documentPost());
      expect([res.status, res.headers.get("location")], JSON.stringify(to)).toEqual([500, null]);
      expect(await res.text()).not.toContain("evil");
      expect(await ctx.storage.get(KEY), JSON.stringify(to)).toBeNull();
    }
  });

  it("a runtime JSON POST answers 500 `keel.unexpected`, echoes none of the value and saves nothing", async () => {
    for (const to of HOSTILE) {
      next = to;
      const { app, ctx } = await serve();
      const res = await app.fetch(jsonPost());
      expect(res.status, JSON.stringify(to)).toBe(500);
      expect(res.headers.get("location")).toBeNull();
      expect(await res.json()).toEqual({
        ok: false,
        error: { code: "keel.unexpected", message: "unexpected", data: {} },
      });
      expect(await ctx.storage.get(KEY), JSON.stringify(to)).toBeNull();
    }
  });

  it("a valid link is still 303 for a document and 200 with the link for JSON, and saves", async () => {
    next = c.href("lo.item", { slug: "a b" });
    const { app, ctx } = await serve();
    const doc = await app.fetch(documentPost());
    expect([doc.status, doc.headers.get("location")]).toEqual([303, "/lo/item/a%20b"]);
    expect(await ctx.storage.get(KEY)).not.toBeNull();
    const res = await app.fetch(jsonPost());
    expect(await res.json()).toEqual({ ok: true, value: "/lo/item/a%20b" });
  });

  it("a client router Form submit navigates nowhere: the Form's error slot shows `keel.unexpected`", async () => {
    for (const to of HOSTILE) {
      const out = await submitInClient(to);
      expect(out, JSON.stringify(to)).toEqual({
        route: "lo.page",
        documents: [],
        pushed: 0,
        shown: "keel.unexpected",
        saved: null,
      });
    }
  });

  it("a client router Form submit of a valid link navigates to its page", async () => {
    const out = await submitInClient(c.href("lo.item", { slug: "x" }));
    expect([out.route, out.documents, out.pushed, out.shown]).toEqual(["lo.item", [], 1, null]);
  });

  it("for generated links, after a submit over each transport the browser's location is on the origin", async () => {
    const link = fc.oneof(
      fc.constant(null),
      fc.constantFrom(...HOSTILE),
      fc.stringMatching(/^[a-z0-9]{1,8}$/).map((slug) => c.href("lo.item", { slug })),
      fc.string({ unit: "binary", maxLength: 12 }),
      fc.string({ unit: "binary", maxLength: 12 }).map((t) => `/${t}`),
      fc
        .tuple(fc.constantFrom("//", "/\\", "\\\\", "http:", "javascript:", "data:", "/\t/", " //"), fc.string())
        .map(([a, b]) => a + b),
    );
    const { app } = await serve();
    await fc.assert(
      fc.asyncProperty(link, async (to) => {
        next = to;
        const tag = JSON.stringify(to);
        // Document: a redirect is the browser's next location.
        const doc = await app.fetch(documentPost());
        const at = doc.headers.get("location");
        if (doc.status === 303) expect(at !== null && onOrigin(at), tag).toBe(true);
        else expect([doc.status, at], tag).toEqual([500, null]);
        // JSON: a caller that follows the value only ever gets a path of the origin.
        const res = await app.fetch(jsonPost());
        const body: unknown = await res.json();
        const value: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "value") : undefined;
        if (res.status === 200)
          expect(value === null || (typeof value === "string" && onOrigin(value)), tag).toBe(true);
        else expect(res.status, tag).toBe(500);
        // Client router: no document navigation leaves, and the page is one of the table's.
        const out = await submitInClient(to);
        for (const d of out.documents) expect(onOrigin(d.url), tag).toBe(true);
        expect(["lo.page", "lo.item"], tag).toContain(out.route);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});
