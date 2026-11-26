import { type Ctx, createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { InspectDoc } from "../modules/inspector/InspectDoc.schema.ts";
import { Inspection } from "../modules/inspector/Inspection.schema.ts";
import { loadInspect } from "../modules/inspector/loadInspect.server.ts";
import { routes } from "../modules/inspector/routes.ts";
import topology from "../topology.ts";

const TARGET = "http://localhost:4180";
/** What a golden-1 dev build serves at `/__keel/inspect` after one `todos.addList`. */
const DOC = {
  live: true,
  graph: {
    nodes: [
      { id: 1, kind: "scope" },
      { id: 2, kind: "signal" },
      { id: 3, kind: "computed" },
      { id: 4, kind: "effect" },
    ],
    edges: [
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },
  stores: {
    "todos.board": {
      state: { lists: [{ id: "l1", name: "Groceries" }], todos: [] },
      log: [{ id: 1, name: "todos.addList", payload: { id: "l1", name: "Groceries" }, at: 1 }],
    },
  },
  ids: {
    "todos.home": {
      file: "modules/todos/AppShell.tsx",
      line: 13,
      col: 9,
      component: "AppShell",
      tag: "a",
      role: "link",
    },
  },
  a11y: { "todos.home": { role: "link", name: "text", tag: "a" } },
  routes: { "todos.index": { path: "/", module: "todos" }, "todos.shell": { path: null, module: "todos" } },
  sections: {
    "todos.recent": { doc: "{ count: int }", value: { count: 1 } },
    "todos.broken": { doc: "string", error: "E1057 inspector section todos.broken read threw: boom" },
  },
};

const simWith = (url: string, res: () => Response) => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route(url, res);
  return ctx;
};
/** The `web` deployable over `ctx`, as `renderRoute`'s `app`: the page's loader runs on its server. */
const appOn = (ctx: Ctx) => createApp({ topology, routes: routeTable(routes), ctx, deployable: "web" });
const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });

describe("inspector.index", () => {
  it("renders the graph, stores and ids of the url's inspect document", async () => {
    const ctx = simWith(`${TARGET}/__keel/inspect`, json(DOC));
    const app = await appOn(ctx);
    const r = await renderRoute("inspector.index", { routes, search: { url: `${TARGET}/` }, ctx, app });
    expect(r.find("inspector.title").text).toBe(`Inspector: ${TARGET}`);
    // One main landmark, a level-1 heading naming the target and a level-2 heading per panel; nothing takes focus.
    expect(r.find("inspector.page").role).toBe("main");
    expect(r.a11y("inspector.title")).toMatchObject({ role: "heading", name: `Inspector: ${TARGET}` });
    expect(r.a11y("inspector.graph.title").role).toBe("heading");
    expect(r.a11y("inspector.stores.title").role).toBe("heading");
    expect(r.focusOrder()).toEqual([]);
    expect(r.find("inspector.live").text).toBe("Live: graph and stores from the running app");
    expect(r.find("inspector.routes").text).toBe("Routes: todos.index, todos.shell");
    expect(r.find("inspector.graph.counts").text).toBe("4 nodes, 2 edges");
    expect(r.find("inspector.node.4").text).toBe("#4 reads #3");
    expect(r.find("inspector.store.todos.board.state").text).toBe(JSON.stringify(DOC.stores["todos.board"].state));
    expect(r.find("inspector.store.todos.board.entry.1").text).toBe("1 todos.addList at 1 (undo reverts this)");
    expect(r.find("inspector.id.todos.home").text).toBe(
      "todos.home: a in AppShell modules/todos/AppShell.tsx:13:9; link, name from text",
    );
    expect(r.find("inspector.section.todos.recent.doc").text).toBe("Type: { count: int }");
    expect(r.find("inspector.section.todos.recent.value").text).toBe('{"count":1}');
    expect(r.find("inspector.section.todos.broken.value").text).toBe(
      "Failed: E1057 inspector section todos.broken read threw: boom",
    );
    r.dispose();
  });

  it("without url it inspects its own origin; a page that never reported is not live", async () => {
    const doc = { ...DOC, live: false, graph: { nodes: [], edges: [] }, stores: {} };
    const ctx = simWith(new URL("/__keel/inspect", location.href).href, json(doc));
    const r = await renderRoute("inspector.index", { routes, ctx, app: await appOn(ctx) });
    expect(r.find("inspector.title").text).toBe(`Inspector: ${location.origin}`);
    expect(r.find("inspector.live").text).toBe("Not live: open the app in a dev build for graph and stores");
    expect(r.find("inspector.graph.counts").text).toBe("0 nodes, 0 edges");
    r.dispose();
  });

  it("a non-2xx answer or a body that is not an inspect document renders InspectError", async () => {
    const downCtx = simWith(`${TARGET}/__keel/inspect`, json({}, 500));
    const down = await renderRoute("inspector.index", {
      routes,
      search: { url: TARGET },
      ctx: downCtx,
      app: await appOn(downCtx),
    });
    expect(down.find("inspector.error.message").text).toBe(`${TARGET} answered 500`);
    expect(down.a11y("inspector.error.title").role).toBe("heading");
    down.dispose();
    const badCtx = simWith(`${TARGET}/__keel/inspect`, json({ live: true }));
    const bad = await renderRoute("inspector.index", {
      routes,
      search: { url: TARGET },
      ctx: badCtx,
      app: await appOn(badCtx),
    });
    expect(bad.find("inspector.error.message").text).toBe(`${TARGET} did not return an inspect document`);
    bad.dispose();
  });
});

describe("loadInspect", () => {
  const HERE = "http://127.0.0.1:5555/?from=1";
  it("without search.url inspects the origin of the request url, not location (RFC 0027)", async () => {
    const ctx = simWith("http://127.0.0.1:5555/__keel/inspect", json(DOC));
    const r = await loadInspect.run({ params: {}, search: {}, url: HERE, caller: "", stores: undefined }, ctx);
    expect(r.ok ? r.value.url : r.error).toBe("http://127.0.0.1:5555");
  });
  it("returns an Inspection with each store's state as JSON text; network failure is inspector.unreachable", async () => {
    expect(InspectDoc.parse(DOC).ok).toBe(true);
    const ctx = simWith(`${TARGET}/__keel/inspect`, json(DOC));
    const r = await loadInspect.run(
      { params: {}, search: { url: TARGET }, url: HERE, caller: "", stores: undefined },
      ctx,
    );
    expect(r.ok && Inspection.parse(r.value).ok).toBe(true);
    expect(r.ok ? r.value.stores["todos.board"]?.state : "").toBe(
      '{"lists":[{"id":"l1","name":"Groceries"}],"todos":[]}',
    );
    const { sections: _, ...plain } = DOC;
    const noSections = simWith(`${TARGET}/__keel/inspect`, json(plain));
    const p = await loadInspect.run(
      { params: {}, search: { url: TARGET }, url: HERE, caller: "", stores: undefined },
      noSections,
    );
    expect(p.ok ? p.value.sections : p.error).toEqual({});
    const failing = createCtx({ mode: "sim", seed: 1 });
    failing.net.route(`${TARGET}/__keel/inspect`, () => Promise.reject(new TypeError("fetch failed")));
    const e = await loadInspect.run(
      { params: {}, search: { url: TARGET }, url: HERE, caller: "", stores: undefined },
      failing,
    );
    expect(e.ok ? "" : e.error).toMatchObject({ code: "inspector.unreachable", message: `${TARGET} is unreachable` });
  });
  it("fetches only a loopback target: any other answers inspector.unreachable and is never fetched", async () => {
    const run = (url: string, ctx: Ctx) =>
      loadInspect.run({ params: {}, search: { url }, url: HERE, caller: "", stores: undefined }, ctx);
    for (const url of ["http://localhost:4180", "https://127.0.0.1", "http://[::1]:9"]) {
      const ctx = simWith(`${url}/__keel/inspect`, json(DOC));
      const r = await run(url, ctx);
      expect(r.ok ? r.value.url : r.error).toBe(url);
    }
    const refused = [
      "http://127.0.0.1.evil.example:4180",
      "http://localhost.evil.example",
      "http://evil.example/127.0.0.1",
      "http://user@127.0.0.1:4180",
      "http://user:pw@localhost",
      "ftp://127.0.0.1",
      "file:///etc/passwd",
      "http://10.0.0.1",
      "http://[::2]",
      "localhost:4180",
      "not a url",
    ];
    for (const url of refused) {
      // Each refused target is also routed: a fetch would answer the document instead of the refusal.
      const ctx = createCtx({ mode: "sim", seed: 1 });
      const parsed = URL.canParse(url) ? new URL(url) : undefined;
      if (parsed !== undefined && /^https?:$/.test(parsed.protocol)) ctx.net.route(`${url}/__keel/inspect`, json(DOC));
      const r = await run(url, ctx);
      expect(r.ok ? "" : r.error).toMatchObject({
        code: "inspector.unreachable",
        message: `${url} is not on this machine`,
      });
    }
  });

  it("follows no redirect: a 3xx from the target answers its status", async () => {
    const ctx = simWith(
      `${TARGET}/__keel/inspect`,
      () => new Response(null, { status: 302, headers: { location: "http://evil.example/__keel/inspect" } }),
    );
    const r = await loadInspect.run(
      { params: {}, search: { url: TARGET }, url: HERE, caller: "", stores: undefined },
      ctx,
    );
    expect(r.ok ? "" : r.error).toMatchObject({ code: "inspector.unreachable", message: `${TARGET} answered 302` });
  });
});
