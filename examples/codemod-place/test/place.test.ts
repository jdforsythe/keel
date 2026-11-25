// k.topology Calls and peers: a call is encoded alike in every topology, so a split adds latency and never another
// value. The page shows the same text with `stock` in `web`, as `topology.ts` has it, and with `stock` on its own
// `api` deployable, as `keel codemod place stock --to api --adapter node` writes it. Both topologies are written out
// here, so the tests pass before and after the codemod.
import { createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes as shop } from "../modules/shop/routes.ts";
import { routes as stock } from "../modules/stock/routes.ts";

const secret = "codemod-place-test-secret-of-32-bytes";
const before = topology({ web: { modules: ["shop", "stock"], adapter: "node", styles: ["@keel/ui/fonts"] } });
const after = topology({
  api: { modules: ["stock"], adapter: "node", styles: ["@keel/ui/fonts"] },
  web: { modules: ["shop"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
const home = () => new Request("http://web.test/", { headers: { accept: "text/html" } });

it("shows the shelf count with stock in the web deployable", async () => {
  const web = await createApp({
    topology: before,
    routes: routeTable(shop, stock),
    ctx: createCtx({ mode: "sim", seed: 1 }),
    deployable: "web",
  });
  expect(await (await web.fetch(home())).text()).toContain("4 lamps on the shelf");
});

it("shows the same count once stock is placed on an api deployable", async () => {
  const api = await createApp({
    topology: after,
    routes: stock,
    ctx: createCtx({ mode: "sim", seed: 1 }),
    deployable: "api",
    secret,
  });
  const ctx = createCtx({ mode: "sim", seed: 2 });
  const seen: string[] = [];
  ctx.net.route("http://api.test/*", (req) => {
    seen.push(new URL(req.url).pathname);
    return api.fetch(req);
  });
  const web = await createApp({
    topology: after,
    routes: shop,
    ctx,
    deployable: "web",
    secret,
    peers: { api: new URL("http://api.test") },
  });
  expect(await (await web.fetch(home())).text()).toContain("4 lamps on the shelf");
  expect(seen).toEqual(["/api/stock/lamp"]);
});

it("renders the shop page as a browser gets it: one main landmark, a named heading, the count as text", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  const table = routeTable(shop, stock);
  const web = await createApp({ topology: before, routes: table, ctx, deployable: "web" });
  const page = await renderRoute("shop.home", { routes: table, params: {}, ctx, app: web });
  try {
    expect(page.find("shop.home").role).toBe("main");
    expect(page.a11y("shop.home.title")).toMatchObject({ role: "heading", name: "Shop" });
    expect(page.find("shop.home.shelf").text).toBe("4 lamps on the shelf");
    expect(page.focusOrder()).toEqual([]);
  } finally {
    page.dispose();
  }
});
