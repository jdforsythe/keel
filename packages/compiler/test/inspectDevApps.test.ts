// `GET /__keel/inspect` under `keel dev` (k.cli Inspect, Inspector hooks; k.topology Local topology): the document
// holds the inspector sections of the `node` deployables' dev apps beside the open page's report, and each deployable's
// own sections under `deployables`.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectMiddleware } from "../src/internal/inspectMiddleware.ts";

type App = { fetch(req: Request): Promise<Response> };
type Named = { name: string; app: App };
/** Name the apps `n0`, `n1`, ... in their order. */
const named = (apps: readonly App[]): Named[] => apps.map((app, i) => ({ name: `n${i}`, app }));
type Handler = ReturnType<typeof inspectMiddleware>;

let root = "";
let server: http.Server | undefined;
let base = "";

const listen = async (mw: Handler): Promise<void> => {
  server = http.createServer((req, res) =>
    mw(req, res, (e) => {
      res.statusCode = e === undefined ? 404 : 500;
      res.end(e === undefined ? "next" : String(e));
    }),
  );
  const s = server;
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const addr: AddressInfo | string | null = s.address();
  base = typeof addr === "object" && addr !== null ? `http://127.0.0.1:${addr.port}` : "";
};
const get = async (): Promise<{ status: number; json: unknown }> => {
  const res = await fetch(`${base}/__keel/inspect`);
  return { status: res.status, json: res.status === 200 ? await res.json() : await res.text() };
};
const post = (body: unknown): Promise<Response> =>
  fetch(`${base}/__keel/inspect`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify(body),
  });

const section = (n: number): { doc: string; value: { n: number } } => ({ doc: "{| n: int |}", value: { n } });
/** A dev app whose inspect document holds `sections`; `seen` gets each request it answers. */
const appOf = (sections: Record<string, unknown>, seen: string[] = []): App => ({
  fetch: (req) => {
    seen.push(
      `${req.method} ${new URL(req.url).pathname} host=${req.headers.get("host")} origin=${req.headers.get("origin")}`,
    );
    return Promise.resolve(
      Response.json({ live: true, graph: { nodes: [9], edges: [] }, stores: { s: {} }, sections }),
    );
  },
});
const PAGE = { graph: { nodes: [{ id: 1 }], edges: [] }, stores: { "todos.board": { state: {}, log: [] } } };

beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-inspect-apps-"));
});
afterEach(async () => {
  const s = server;
  if (s !== undefined) await new Promise<void>((resolve) => s.close(() => resolve()));
  server = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("inspectMiddleware with dev apps", () => {
  it("serves a dev app's sections before any page reports, asking the app as the caller's host", async () => {
    const seen: string[] = [];
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => Promise.resolve(named([appOf({ "kitchen.box": section(3) }, seen)])),
      ),
    );
    const { status, json } = await get();
    expect(status).toBe(200);
    expect(json).toEqual({
      live: false,
      graph: { nodes: [], edges: [] },
      stores: {},
      sections: { "kitchen.box": section(3) },
      deployables: { n0: { sections: { "kitchen.box": section(3) } } },
      ids: {},
      a11y: {},
      routes: {},
    });
    expect(seen).toEqual([`GET /__keel/inspect host=${new URL(base).host} origin=null`]);
  });

  it("keeps the page's graph, stores and own sections, and the app's section where both serve an id", async () => {
    const apps = [appOf({ "timings.recent": section(1), "kitchen.box": section(2) })];
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => Promise.resolve(named(apps)),
      ),
    );
    const sections = { "timings.recent": section(7), "page.only": section(8) };
    expect((await post({ ...PAGE, sections })).status).toBe(204);
    expect((await get()).json).toMatchObject({
      live: true,
      graph: PAGE.graph,
      stores: PAGE.stores,
      sections: { "timings.recent": section(1), "kitchen.box": section(2), "page.only": section(8) },
    });
  });

  it("keeps each deployable's own sections under deployables: the page's by the name it posts, each app's by its own", async () => {
    const apps: Named[] = [{ name: "api", app: appOf({ "timings.recent": section(1), "kitchen.box": section(2) }) }];
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => Promise.resolve(apps),
      ),
    );
    const sections = { "timings.recent": section(7), "page.only": section(8) };
    expect((await post({ ...PAGE, sections, deployable: "web" })).status).toBe(204);
    const { json } = await get();
    expect(json).toMatchObject({
      sections: { "timings.recent": section(1), "kitchen.box": section(2), "page.only": section(8) },
      deployables: {
        api: { sections: { "timings.recent": section(1), "kitchen.box": section(2) } },
        web: { sections },
      },
    });
    expect(Object.keys(Object(json).deployables)).toEqual(["api", "web"]);
  });

  it("a report whose deployable is not a string is refused with 400", async () => {
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => Promise.resolve([]),
      ),
    );
    expect((await post({ ...PAGE, deployable: 3 })).status).toBe(400);
  });

  it("without dev apps the document holds no deployables, even after a page names its own", async () => {
    await listen(inspectMiddleware(() => root));
    expect((await post({ ...PAGE, sections: { "page.only": section(1) }, deployable: "web" })).status).toBe(204);
    const { json } = await get();
    expect(json).toMatchObject({ live: true, sections: { "page.only": section(1) } });
    expect(Object.keys(Object(json))).not.toContain("deployables");
  });

  it("of two apps serving one id keeps the first by name, and reads the apps again on every request", async () => {
    let n = 0;
    const counting: App = { fetch: () => Promise.resolve(Response.json({ sections: { "a.count": section(++n) } })) };
    const apps = [counting, appOf({ "a.count": section(100), "b.only": section(5) })];
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => Promise.resolve(named(apps)),
      ),
    );
    expect((await get()).json).toMatchObject({ sections: { "a.count": section(1), "b.only": section(5) } });
    expect((await get()).json).toMatchObject({ sections: { "a.count": section(2), "b.only": section(5) } });
  });

  it("an app that refuses, or answers no inspect document, adds no section", async () => {
    const apps: App[] = [
      { fetch: () => Promise.resolve(Response.json({ sections: { "x.denied": section(1) } }, { status: 403 })) },
      { fetch: () => Promise.resolve(new Response("<html>")) },
      { fetch: () => Promise.resolve(Response.json({ sections: [section(1)] })) },
      { fetch: () => Promise.resolve(Response.json(null)) },
      appOf({ "kitchen.box": section(4) }),
    ];
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => Promise.resolve(named(apps)),
      ),
    );
    const { status, json } = await get();
    expect(status).toBe(200);
    expect(json).toMatchObject({ sections: { "kitchen.box": section(4) } });
    expect(Object.keys(Object(json).sections)).toEqual(["kitchen.box"]);
  });

  it("passes on a failure to load the dev apps, and still refuses a foreign host first", async () => {
    let asked = 0;
    await listen(
      inspectMiddleware(
        () => root,
        [],
        () => {
          asked += 1;
          return Promise.reject(new Error("E1057 broken app"));
        },
      ),
    );
    expect(await get()).toEqual({ status: 500, json: "Error: E1057 broken app" });
    expect(asked).toBe(1);
    const denied = await fetch(`${base}/__keel/inspect`, { headers: { origin: "http://evil.example" } });
    expect(denied.status).toBe(403);
    expect(asked).toBe(1);
  });
});

describe("plugin wiring under keel dev", () => {
  const wire = (topology: string): { loads: () => number; inspect: Handler } => {
    fs.writeFileSync(path.join(root, "topology.ts"), topology);
    let loads = 0;
    const p = keel();
    p.configResolved({ root });
    const used: Handler[] = [];
    p.configureServer({
      moduleGraph: { getModuleById: () => undefined },
      reloadModule: () => Promise.resolve(),
      ssrLoadModule: () => {
        loads += 1;
        const app = { ...appOf({ "kitchen.box": section(loads) }), close: () => Promise.resolve() };
        return Promise.resolve({ apps: [["api", app, () => false, undefined]] });
      },
      middlewares: { use: (fn) => void used.push(fn) },
    });
    const inspect = used[0];
    if (inspect === undefined) throw new Error("no inspect middleware");
    return { loads: () => loads, inspect };
  };

  it("the inspect endpoint serves the sections of the node deployables' dev apps, loaded once", async () => {
    const w = wire(`export default { api: { modules: ["a"], adapter: "node" } };\n`);
    await listen(w.inspect);
    expect((await get()).json).toMatchObject({
      live: false,
      sections: { "kitchen.box": section(1) },
      deployables: { api: { sections: { "kitchen.box": section(1) } } },
    });
    expect((await get()).json).toMatchObject({ sections: { "kitchen.box": section(1) } });
    expect(w.loads()).toBe(1);
  });

  it("a topology without a node deployable loads no dev app for it", async () => {
    const w = wire(`export default { web: { modules: ["a"], adapter: "client" } };\n`);
    await listen(w.inspect);
    expect((await get()).json).toMatchObject({ live: false, sections: {} });
    expect(w.loads()).toBe(0);
  });
});
