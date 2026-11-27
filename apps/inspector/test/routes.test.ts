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
/** The `web` deployable over `ctx`; `inspector.index` is `local: true`, so a request with no connection is refused. */
const appOn = (ctx: Ctx) => createApp({ topology, routes: routeTable(routes), ctx, deployable: "web" });
const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });

describe("inspector.index", () => {
  it("renders the graph, stores and ids of the url's inspect document", async () => {
    const ctx = simWith(`${TARGET}/__keel/inspect`, json(DOC));
    const r = await renderRoute("inspector.index", { routes, search: { url: `${TARGET}/` }, ctx });
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
    const r = await renderRoute("inspector.index", { routes, ctx });
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
    });
    expect(down.find("inspector.error.message").text).toBe(`no inspect document at ${TARGET}`);
    expect(down.a11y("inspector.error.title").role).toBe("heading");
    down.dispose();
    const badCtx = simWith(`${TARGET}/__keel/inspect`, json({ live: true }));
    const bad = await renderRoute("inspector.index", {
      routes,
      search: { url: TARGET },
      ctx: badCtx,
    });
    expect(bad.find("inspector.error.message").text).toBe(`no inspect document at ${TARGET}`);
    bad.dispose();
  });
});

describe("loadInspect", () => {
  const HERE = "http://127.0.0.1:5555/?from=1";
  /** The loader run directly, as a request to `HERE`. */
  const call = (search: { url?: string }, ctx: Ctx) =>
    loadInspect.run({ params: {}, search, url: HERE, caller: "", stores: undefined }, ctx);
  /** A sim ctx answering every path of `origin` with the document, counting what it was asked for. */
  const counting = (origin: string) => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const asked: string[] = [];
    for (const path of ["/__keel/inspect", "/admin/delete-all", "/admin/delete-all%23", "/", "/x"])
      ctx.net.route(`${origin}${path}`, (req: Request) => {
        asked.push(new URL(req.url).pathname);
        return json(DOC)();
      });
    return { ctx, asked };
  };

  it("without search.url inspects the origin of the request url, not location (RFC 0027)", async () => {
    const ctx = simWith("http://127.0.0.1:5555/__keel/inspect", json(DOC));
    const r = await call({}, ctx);
    expect(r.ok ? r.value.url : r.error).toBe("http://127.0.0.1:5555");
  });
  it("returns an Inspection with each store's state as JSON text; network failure is inspector.unreachable", async () => {
    expect(InspectDoc.parse(DOC).ok).toBe(true);
    const ctx = simWith(`${TARGET}/__keel/inspect`, json(DOC));
    const r = await call({ url: TARGET }, ctx);
    expect(r.ok && Inspection.parse(r.value).ok).toBe(true);
    expect(r.ok ? r.value.stores["todos.board"]?.state : "").toBe(
      '{"lists":[{"id":"l1","name":"Groceries"}],"todos":[]}',
    );
    const { sections: _, ...plain } = DOC;
    const p = await call({ url: TARGET }, simWith(`${TARGET}/__keel/inspect`, json(plain)));
    expect(p.ok ? p.value.sections : p.error).toEqual({});
    const failing = createCtx({ mode: "sim", seed: 1 });
    failing.net.route(`${TARGET}/__keel/inspect`, () => Promise.reject(new TypeError("fetch failed")));
    const e = await call({ url: TARGET }, failing);
    expect(e.ok ? "" : e.error).toMatchObject({
      code: "inspector.unreachable",
      message: `no inspect document at ${TARGET}`,
    });
  });
  it("takes only the origin of a loopback app: anything more or another host is refused and nothing is fetched", async () => {
    for (const url of ["http://localhost:4180", "https://127.0.0.1", "http://[::1]:9", "http://localhost:4180/"]) {
      const origin = new URL(url).origin;
      const r = await call({ url }, simWith(`${origin}/__keel/inspect`, json(DOC)));
      expect(r.ok ? r.value.url : r.error).toBe(origin);
    }
    const refused = [
      `${TARGET}/admin/delete-all%23`,
      `${TARGET}/admin/delete-all#`,
      `${TARGET}/?q=x`,
      `${TARGET}?`,
      `${TARGET}#`,
      `${TARGET}/x`,
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
      const { ctx, asked } = counting(URL.canParse(url) ? new URL(url).origin : TARGET);
      const r = await call({ url }, ctx);
      expect(r.ok ? "" : r.error, url).toMatchObject({
        code: "inspector.unreachable",
        message: "?url= is not the origin of an app on this machine",
      });
      expect(asked, url).toEqual([]);
    }
  });
  it("is a local route: the server answers a loopback connection with a loopback Host and an own-site navigation, else keel.denied with nothing fetched", async () => {
    const over = (remoteAddress: string | undefined) =>
      remoteAddress === undefined ? undefined : { incoming: { socket: { remoteAddress } } };
    const ask = async (remote: string | undefined, host: string, site: string | undefined) => {
      const { ctx, asked } = counting(TARGET);
      const app = await appOn(ctx);
      const headers: Record<string, string> = {
        host,
        accept: "text/html",
        ...(site === undefined ? {} : { "sec-fetch-site": site }),
      };
      const res = await app.fetch(
        new Request(`http://${host}/?url=${encodeURIComponent(TARGET)}`, { headers }),
        over(remote),
      );
      const body = await res.text();
      await app.close();
      return { status: res.status, body, asked };
    };
    for (const [remote, host, site] of [
      ["127.0.0.1", "127.0.0.1:5555", "none"],
      ["::1", "localhost:5555", "same-origin"],
      ["::ffff:127.0.0.1", "[::1]:5555", "none"],
    ] as const) {
      const r = await ask(remote, host, site);
      expect(r.status, `${remote} ${host}`).toBe(200);
      expect(r.asked).toEqual(["/__keel/inspect"]);
    }
    for (const [remote, host, site] of [
      [undefined, "127.0.0.1:5555", "none"],
      ["127.0.0.1", "127.0.0.1:5555", "cross-site"],
      ["127.0.0.1", "127.0.0.1:5555", "same-site"],
      ["127.0.0.1", "127.0.0.1:5555", undefined],
      ["127.0.0.1", "evil.example:5555", "same-origin"],
      ["127.0.0.1", "127.0.0.1", "none"],
      ["192.168.1.5", "localhost:5555", "same-origin"],
    ] as const) {
      const r = await ask(remote, host, site);
      expect(r.status, `${remote} ${host} ${site}`).toBe(403);
      expect(r.body).toContain("keel.denied");
      expect(r.asked).toEqual([]);
    }
  });
  it("gives one text for every failure: a status, a redirect not followed, a body that is no inspect document", async () => {
    const answers = [
      () => new Response(null, { status: 302, headers: { location: "http://evil.example/__keel/inspect" } }),
      json({}, 500),
      json({ live: true }),
      () => new Response("hello", { status: 200 }),
    ];
    for (const answer of answers) {
      const r = await call({ url: TARGET }, simWith(`${TARGET}/__keel/inspect`, answer));
      expect(r.ok ? "" : r.error).toMatchObject({
        code: "inspector.unreachable",
        message: `no inspect document at ${TARGET}`,
      });
    }
  });
});
