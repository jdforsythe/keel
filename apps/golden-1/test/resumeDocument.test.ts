// A `todos.list` document served by the node adapter, resumed with `resumeDocument` as the browser's generated entry
// resumes it: the island's Done checkbox posts the toggle through the resumed handlers, addressed by id only.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { resumeDocument } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "../modules/todos/routes.ts";
import { boardOf } from "./at.ts";
import { apiApp, readBoard, resetApi, seedBoard, simApi } from "./simApi.ts";

afterEach(resetApi);

const seeded = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [{ id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false }],
});

/** The `todos` pages as a node deployable whose loaders reach the `api` module through `ctx.net`. */
async function webApp() {
  const api = await apiApp();
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route("http://api.keel.invalid/api/*", (req) => api.fetch(req));
  return createApp({ topology: topology({ web: { modules: ["todos"], adapter: "node" } }), routes, ctx });
}

describe("golden-1 server document, resumed", () => {
  // Expected to fail until a layout-wrapped island and `For`/`If` regions resume from server HTML (E1253 today).
  it.fails("the resumed Done checkbox of /lists/l1 posts the toggle and shows it checked", async () => {
    await seedBoard(seeded);
    const app = await webApp();
    const res = await app.fetch(new Request("http://localhost/lists/l1", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(200);
    const { ctx, sent } = await simApi();
    const t = await resumeDocument(await res.text(), { routes, ctx });
    expect(t.find("todos.toggle.t1")).toMatchObject({
      role: "checkbox",
      name: "Done: Milk",
      state: { checked: false },
    });
    await t.fire("todos.toggle.t1", { type: "change" });
    expect(sent).toContain("POST /api/todos/t1/toggle");
    expect((await readBoard()).todos.map((x) => x.done)).toEqual([true]);
    expect(t.find("todos.toggle.t1").state.checked).toBe(true);
    t.dispose();
  });
});
