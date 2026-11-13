// @vitest-environment happy-dom
// Examples: DOM-node components, resume markup (data-k-island, #k-state), guards by name, methods, 422 HTML.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { action, guard, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { store, stores, transaction, tx } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const BASE = "http://localhost";
const Page = s.object({ title: s.string() });
const Edit = s.object({ note: s.string({ min: 3 }) });

const el = (tag: string, attrs: Record<string, string>, ...kids: (Node | string)[]): HTMLElement => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

const state = (html: string): unknown => {
  const m = [...html.matchAll(/<script type="application\/json" id="k-state">([\s\S]*?)<\/script>/g)];
  expect(m.length).toBe(1);
  return JSON.parse(m[0]?.[1] ?? "");
};

type Opts = {
  requestStore?: string;
  title?: string;
  mode?: "dev" | "production";
  deny?: boolean;
  throwIn?: "page" | "shell";
};

async function build(o: Opts = {}) {
  const auth = guard({ redirect: "app.login" }, () =>
    Promise.resolve(o.deny === true ? err({ code: "keel.denied", message: "no", data: {} }) : ok(null)),
  );
  const routes = manifest({
    "app.shell": {
      component: ({ children }) => {
        if (o.throwIn === "shell") throw new Error("shell broke");
        return el("div", { id: "app" }, children?.() ?? "");
      },
    },
    "app.home": {
      path: "/",
      layout: "app.shell",
      loader: loader({ output: Page }, () => Promise.resolve(ok({ title: o.title ?? "Home" }))),
      guard: auth,
      component: ({ data }) => {
        if (o.throwIn === "page") throw new Error("page broke");
        if (o.requestStore !== undefined) store(s.object({ n: s.int() }), { n: 3 }, { id: o.requestStore });
        const t = typeof data === "object" && data !== null && "title" in data ? String(data.title) : "?";
        // `data-k` stands in for a compiler-marked bound element: the page level is an island (rfc:0037).
        return el("section", { "data-page": "home", "data-k": "app.home" }, el("h1", {}, t));
      },
      errorElement: ({ error }) => el("p", { "data-error": error.code }, error.message),
    },
    "app.login": { path: "/login", component: () => el("main", {}, "login") },
  });
  routes.actions({
    "app.home": {
      POST: action({ input: Edit }, () => ok(null)),
      PATCH: action({ input: Edit }, () => err({ code: "app.locked", message: "locked", data: {} })),
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: o.mode ?? "production",
  });
  return app;
}

const get = (path: string, headers: Record<string, string> = {}) => new Request(`${BASE}${path}`, { headers });
const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(`${BASE}${path}`, { method: "POST", body: fd, headers });
};

describe("document", () => {
  it("renders DOM components inside layouts, marks only island roots, serializes their props and loads the entry", async () => {
    const app = await build({ title: "Hello" });
    const res = await app.fetch(get("/"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<div id="app"><section data-page="home" data-k="app.home" data-k-island="app.home">');
    expect(html.match(/<script type="module" src="\/@keel\/entry.ts" nonce="[0-9a-f]{64}"><\/script>/g)?.length).toBe(
      1,
    );
    expect(html).toContain("<main>");
    expect(state(html)).toMatchObject({
      islands: { "app.home": { params: {}, search: {}, data: { title: "Hello" } } },
    });
  });

  it("escapes loader data so it cannot close the k-state script", async () => {
    const app = await build({ title: "</script><script>alert(1)</script>" });
    const html = await (await app.fetch(get("/"))).text();
    expect(state(html)).toMatchObject({
      islands: { "app.home": { data: { title: "</script><script>alert(1)</script>" } } },
    });
    expect(html).not.toContain("<script>alert(1)");
  });

  it("module-level stores are process-wide and never reach #k-state (RFC 0044)", async () => {
    const Counter = s.object({ n: s.int() });
    const sc = scope(() => {
      const counter = store(Counter, { n: 0 }, { id: "app.logged" });
      tx(
        transaction(counter, "app.bump", s.object({}), (st) => ({ n: st.n + 1 })),
        {},
      );
    });
    const html = await (await (await build()).fetch(get("/"))).text();
    expect(state(html)).toMatchObject({ stores: {} });
    expect(html).not.toContain("app.bump");
    sc.dispose();
  });

  it("a store created inside the request scope is in #k-state, then disposed with the request", async () => {
    const Counter = s.object({ n: s.int() });
    const app = await build({ requestStore: "app.perRequest" });
    for (let i = 0; i < 2; i++) {
      const html = await (await app.fetch(get("/"))).text();
      expect(state(html)).toMatchObject({ stores: { "app.perRequest": { state: { n: 3 } } } });
    }
    expect(stores().has("app.perRequest")).toBe(false);
    expect(Counter.node.kind).toBe("object");
  });

  it("actions and redirects are cache-control: no-store; a document is private, no-store", async () => {
    const app = await build();
    const ok303 = await app.fetch(post("/", { note: "hello" }));
    expect(ok303.status).toBe(303);
    expect(ok303.headers.get("cache-control")).toBe("no-store");
    const json = await app.fetch(post("/", { note: "hello" }, { accept: "application/json" }));
    expect(json.headers.get("cache-control")).toBe("no-store");
    const bad = await app.fetch(post("/", { note: "x" }));
    expect(bad.status).toBe(422);
    expect(bad.headers.get("cache-control")).toBe("no-store");
    expect((await app.fetch(get("/"))).headers.get("cache-control")).toBe("private, no-store");
  });

  it("a throw in a route with an errorElement renders it with 500; production hides the message", async () => {
    const res = await (await build({ throwIn: "page" })).fetch(get("/"));
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain('data-error="keel.unexpected"');
    expect(html).toContain('<div id="app"');
    expect(html).not.toContain("page broke");
  });

  it("a throw outside every boundary renders the default alert with 500; dev shows the message", async () => {
    const res = await (await build({ throwIn: "shell", mode: "dev" })).fetch(get("/"));
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain('data-keel-error="keel.unexpected"');
    expect(html).toContain("shell broke");
  });

  it("resolves a guard by name from `guards`; denial redirects with next", async () => {
    const res = await (await build({ deny: true })).fetch(get("/?a=1"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/login?next=${encodeURIComponent("/?a=1")}`);
    const w = await (await build({ deny: true })).fetch(post("/", { note: "abcd" }));
    expect(w.status).toBe(303);
  });

  it("a route's guard is the value it holds; a denial redirects within the served manifest (RFC 0041)", async () => {
    const no = guard({ redirect: "app.login" }, () =>
      Promise.resolve(err({ code: "keel.denied", message: "no", data: {} })),
    );
    const routes = manifest({
      "app.c": { path: "/c", component: () => el("p", {}), guard: no },
      "app.login": { path: "/login", component: () => el("main", {}, "login") },
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
    });
    const res = await app.fetch(get("/c"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/login?next=${encodeURIComponent("/c")}`);
  });

  it("a denial whose redirect is not a route of the served manifest is 500", async () => {
    const no = guard({ redirect: "app.nowhere" }, () =>
      Promise.resolve(err({ code: "keel.denied", message: "no", data: {} })),
    );
    const routes = manifest({ "app.a": { path: "/a", component: () => el("p", {}), guard: no } });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "dev",
    });
    const a = await app.fetch(get("/a"));
    expect(a.status).toBe(500);
    expect(await a.text()).toContain("guard redirect to &quot;app.nowhere&quot; failed");
  });

  it("a runtime GET returns each level's Result keyed by route id", async () => {
    const res = await (await build({ title: "T" })).fetch(get("/", { accept: "application/json" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "app.home",
      results: { "app.shell": { ok: true, value: null }, "app.home": { ok: true, value: { title: "T" } } },
    });
  });

  it("422 HTML: the page re-renders with the field summary and the submission in k-state", async () => {
    const res = await (await build()).fetch(post("/", { note: "ab" }));
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('<li data-field="note">note: Must be at least 3 characters</li>');
    expect(html).toContain('data-page="home"');
    expect(state(html)).toMatchObject({
      form: { route: "app.home", method: "POST", values: { note: "ab" }, errors: { note: expect.any(String) } },
    });
  });

  it("a document action err renders at the route errorElement with its status", async () => {
    const res = await (await build()).fetch(post("/", { note: "abcd", _method: "PATCH" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('data-error="app.locked"');
  });

  it("methods: 405 without an action or for other methods; HEAD has no body", async () => {
    const app = await build();
    const del = await app.fetch(post("/", { note: "abcd", _method: "DELETE" }));
    expect(del.status).toBe(405);
    expect(del.headers.get("allow")).toBe("GET, HEAD, POST, PATCH");
    expect((await app.fetch(new Request(`${BASE}/`, { method: "OPTIONS" }))).status).toBe(405);
    const head = await app.fetch(new Request(`${BASE}/`, { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("an unknown path is 404 without a redirect, even with a trailing slash", async () => {
    const app = await build();
    expect((await app.fetch(get("/nope/"))).status).toBe(404);
    const res = await app.fetch(get("/login/"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("createApp needs `deployable` when the topology has several, and serves only its modules", async () => {
    const routes = manifest({
      "app.a": { path: "/a", component: () => el("p", {}, "a") },
      "web.b": { path: "/b", component: () => el("p", {}, "b") },
    });
    const t = topology({ one: { modules: ["app"], adapter: "node" }, two: { modules: ["web"], adapter: "static" } });
    const ctx = createCtx({ mode: "sim", seed: SEED });
    await expect(createApp({ topology: t, routes, ctx })).rejects.toThrow(/^E1552 pass deployable/);
    const two = await createApp({ topology: t, routes, ctx, deployable: "two" });
    expect((await two.fetch(get("/b"))).status).toBe(200);
    expect((await two.fetch(get("/a"))).status).toBe(404);
  });
});
