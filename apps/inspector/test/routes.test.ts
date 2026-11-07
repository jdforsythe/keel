import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { InspectDoc } from "../modules/inspector/InspectDoc.schema.ts";
import { Inspection } from "../modules/inspector/Inspection.schema.ts";
import { loadInspect } from "../modules/inspector/loadInspect.server.ts";
import { routes } from "../modules/inspector/routes.ts";

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
};

const simWith = (url: string, res: () => Response) => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route(url, res);
  return ctx;
};
const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });

describe("inspector.index", () => {
  it("renders the graph, stores and ids of the url's inspect document", async () => {
    const ctx = simWith(`${TARGET}/__keel/inspect`, json(DOC));
    const r = await renderRoute("inspector.index", { routes, search: { url: `${TARGET}/` }, ctx });
    expect(r.find("inspector.title").text).toBe(`Inspector: ${TARGET}`);
    expect(r.find("inspector.live").text).toBe("Live: graph and stores from the running app");
    expect(r.find("inspector.routes").text).toBe("Routes: todos.index, todos.shell");
    expect(r.find("inspector.graph.counts").text).toBe("4 nodes, 2 edges");
    expect(r.find("inspector.node.4").text).toBe("#4 reads #3");
    expect(r.find("inspector.store.todos.board.state").text).toBe(JSON.stringify(DOC.stores["todos.board"].state));
    expect(r.find("inspector.store.todos.board.entry.1").text).toBe("1 todos.addList at 1 (undo reverts this)");
    expect(r.find("inspector.id.todos.home").text).toBe(
      "todos.home: a in AppShell modules/todos/AppShell.tsx:13:9; link, name from text",
    );
    r.dispose();
  });

  it("without url it inspects its own origin; a page that never reported is not live", async () => {
    const doc = { ...DOC, live: false, graph: { nodes: [], edges: [] }, stores: {} };
    const ctx = simWith(new URL("/__keel/inspect", location.href).href, json(doc));
    const r = await renderRoute("inspector.index", { routes, ctx });
    expect(r.find("inspector.title").text).toBe(`Inspector: ${location.origin}`);
    expect(r.find("inspector.live").text).toBe("Not live: open the app in a dev build for graph and stores");
    expect(r.find("inspector.graph.counts").text).toBe("0 nodes, 0 edges");
    r.dispose();
  });

  it("a non-2xx answer or a body that is not an inspect document renders InspectError", async () => {
    const down = await renderRoute("inspector.index", {
      routes,
      search: { url: TARGET },
      ctx: simWith(`${TARGET}/__keel/inspect`, json({}, 500)),
    });
    expect(down.find("inspector.error.message").text).toBe(`${TARGET} answered 500`);
    down.dispose();
    const bad = await renderRoute("inspector.index", {
      routes,
      search: { url: TARGET },
      ctx: simWith(`${TARGET}/__keel/inspect`, json({ live: true })),
    });
    expect(bad.find("inspector.error.message").text).toBe(`${TARGET} did not return an inspect document`);
    bad.dispose();
  });
});

describe("loadInspect", () => {
  const HERE = "http://inspector.test:5555/?from=1";
  it("without search.url inspects the origin of the request url, not location (RFC 0027)", async () => {
    const ctx = simWith("http://inspector.test:5555/__keel/inspect", json(DOC));
    const r = await loadInspect.run({ params: {}, search: {}, url: HERE }, ctx);
    expect(r.ok ? r.value.url : r.error).toBe("http://inspector.test:5555");
  });
  it("returns an Inspection with each store's state as JSON text; network failure is inspector.unreachable", async () => {
    expect(InspectDoc.parse(DOC).ok).toBe(true);
    const ctx = simWith(`${TARGET}/__keel/inspect`, json(DOC));
    const r = await loadInspect.run({ params: {}, search: { url: TARGET }, url: HERE }, ctx);
    expect(r.ok && Inspection.parse(r.value).ok).toBe(true);
    expect(r.ok ? r.value.stores["todos.board"]?.state : "").toBe(
      '{"lists":[{"id":"l1","name":"Groceries"}],"todos":[]}',
    );
    const failing = createCtx({ mode: "sim", seed: 1 });
    failing.net.route(`${TARGET}/__keel/inspect`, () => Promise.reject(new TypeError("fetch failed")));
    const e = await loadInspect.run({ params: {}, search: { url: TARGET }, url: HERE }, failing);
    expect(e.ok ? "" : e.error).toMatchObject({ code: "inspector.unreachable", message: `${TARGET} is unreachable` });
  });
});
