// @vitest-environment node
// The `api` deployable in plain node: no happy-dom, so createApp installs the DOM-free server tree. golden-1's `todos`
// pages are client-only (`topology.ts`): no served document of them is tested here.
import { afterEach, describe, expect, it } from "vitest";
import { routes as apiRoutes } from "../modules/api/routes.ts";
import { boardOf } from "./at.ts";
import { apiApp, resetApi, seedBoard } from "./simApi.ts";

const BASE = "http://localhost";
afterEach(resetApi);

const seeded = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [{ id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false }],
});

const page = async (fetch: (r: Request) => Promise<Response>, path: string) => {
  const res = await fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));
  return { status: res.status, html: await res.text() };
};

describe("golden-1 api in plain node (no DOM global)", () => {
  it("has no DOM global before createApp", () => {
    expect(typeof document).toBe("undefined");
  });

  it("answers the api deployable's GET routes as JSON whatever accept says", async () => {
    await seedBoard(seeded);
    const app = await apiApp();
    for (const id of ["api.lists", "api.suggestions"] as const) {
      const path = apiRoutes.contract.entries[id].path;
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
