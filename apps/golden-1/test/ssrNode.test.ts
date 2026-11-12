// @vitest-environment node
// Server rendering in plain node (backlog 0156): no happy-dom, so createApp installs the DOM-free server tree and
// every compiled template of the real `todos` pages renders on it. `todos` is a client deployable in topology.ts;
// here it is served by the node adapter (a test topology) over a sim ctx whose net reaches the real `api` app.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { afterEach, describe, expect, it } from "vitest";
import { routes as apiRoutes } from "../modules/api/routes.ts";
import { routes } from "../modules/todos/routes.ts";
import { boardOf } from "./at.ts";
import { apiApp, resetApi, seedBoard } from "./simApi.ts";

const BASE = "http://localhost";
afterEach(resetApi);

const seeded = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [{ id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false }],
});

/** The `todos` pages as a node deployable whose loaders reach the `api` module (unbound: `http://api.keel.invalid`) through `ctx.net`. */
async function webApp() {
  const api = await apiApp();
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route("http://api.keel.invalid/api/*", (req) => api.fetch(req));
  return createApp({ topology: topology({ web: { modules: ["todos"], adapter: "node" } }), routes, ctx });
}

const page = async (fetch: (r: Request) => Promise<Response>, path: string) => {
  const res = await fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));
  return { status: res.status, html: await res.text() };
};

describe("golden-1 documents in plain node (no DOM global)", () => {
  it("has no DOM global before createApp", () => {
    expect(typeof document).toBe("undefined");
  });

  it("renders every todos GET route with its data", async () => {
    await seedBoard(seeded);
    const app = await webApp();
    const index = await page(app.fetch, "/");
    expect(index.status).toBe(200);
    expect(index.html).toContain('id="todos.listLink.l1" class="k-fg-text">Home</a>');
    expect(index.html).toContain(">1 open</span>");
    const list = await page(app.fetch, "/lists/l1");
    expect(list.status).toBe(200);
    expect(list.html).toContain('id="todos.list.title" class="k-m-0 k-fontSize-2xl k-weight-semibold">Home</h1>');
    expect(list.html).toContain(">Done: Milk</label>");
    // Backlog 0166 (rfc:0062): `Field.bind` writes the first render's value as the markup default, so the edit form
    // shows the todo's values before any script runs (an IDL value alone never reaches the HTML).
    const edit = await page(app.fetch, "/lists/l1/todos/t1/edit");
    expect(edit.status).toBe(200);
    expect(edit.html).toContain(">Title</label>");
    expect(edit.html).toMatch(/<input type="text"[^>]* name="title" value="Milk">/);
    expect(edit.html).toContain('<option value="low">Low</option><option value="normal" selected="">Normal</option>');
    // A loader's keel.notFound renders the route's compiled errorElement (ListError) in a render unit too.
    const missing = await page(app.fetch, "/lists/nope");
    expect(missing.status).toBe(404);
    expect(missing.html).toContain('id="todos.error.message" class="k-m-0 k-font-mono k-fontSize-sm">No list nope</p>');
  });

  it("answers the api deployable's GET routes as JSON whatever accept says", async () => {
    await seedBoard(seeded);
    const app = await apiApp();
    for (const id of ["api.lists", "api.suggestions"] as const) {
      const path = apiRoutes.routes[id].path;
      const r = await page(app.fetch, path);
      expect(r.status, path).toBe(200);
      expect(r.html, path).not.toContain("<!doctype html>");
      expect(JSON.parse(r.html).id, path).toBe(id);
    }
    const digest = await page(app.fetch, "/digest");
    expect(digest.status).toBe(200);
    expect(JSON.parse(digest.html).id).toBe("digest.show");
  });
});
