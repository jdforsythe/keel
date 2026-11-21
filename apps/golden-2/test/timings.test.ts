import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { TimingsRecent, timingsOf } from "@keel/std-timings";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { recipes } from "../modules/recipes/recipes.contract.ts";
import { routes } from "../modules/recipes/routes.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { artifacts } from "./artifacts.ts";
import { apiApp, apiCtx, asJson, draft } from "./simApi.ts";

describe("timings of the kitchen's catalog query", () => {
  it("counts one kitchen.catalog.query per catalog request on the api's ctx, and none for other routes", async () => {
    const server = apiCtx();
    const app = await apiApp(server);
    expect(timingsOf(server)).toEqual({});
    await app.fetch(asJson("POST", "/api/recipes", draft("Soup", 30)));
    await app.fetch(asJson("GET", "/api/recipes"));
    expect(timingsOf(server)).toEqual({});
    await app.fetch(asJson("GET", "/api/catalog/en-US"));
    await app.fetch(asJson("GET", "/api/catalog/de-DE?sort=price"));
    expect(timingsOf(server)).toEqual({ "kitchen.catalog.query": { count: 2, totalMs: 0, maxMs: 0, lastMs: 0 } });
  });
  it("shows them in the dev inspect document as timings.recent", async () => {
    const server = apiCtx();
    const app = await createApp({ topology, routes: apiRoutes, ctx: server, deployable: "api", mode: "dev" });
    await app.fetch(asJson("GET", "/api/catalog/ja-JP"));
    const body: unknown = await (await app.fetch(new Request("http://localhost/__keel/inspect"))).json();
    const sections = typeof body === "object" && body !== null && "sections" in body ? body.sections : null;
    const section =
      typeof sections === "object" && sections !== null && "timings.recent" in sections
        ? sections["timings.recent"]
        : null;
    const value = typeof section === "object" && section !== null && "value" in section ? section.value : null;
    expect(TimingsRecent.parse(value)).toEqual({
      ok: true,
      value: { timings: { "kitchen.catalog.query": { count: 1, totalMs: 0, maxMs: 0, lastMs: 0 } }, dropped: 0 },
    });
  });
});

describe("timings of the recipes pages' api calls", () => {
  it("records how long the catalog page waited for each kitchen call on the page's clock", async () => {
    const app = await apiApp(apiCtx());
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(new URL("/api/*", location.href).href, (req) => {
      ctx.clock.advance(new URL(req.url).pathname.startsWith("/api/catalog/") ? 40 : 15);
      return app.fetch(req);
    });
    const r = await renderRoute("recipes.catalog", { routes, params: { locale: "en-US" }, ctx, artifacts });
    expect(timingsOf(ctx)).toEqual({
      "recipes.api.box": { count: 1, totalMs: 15, maxMs: 15, lastMs: 15 },
      "recipes.api.catalog": { count: 1, totalMs: 40, maxMs: 40, lastMs: 40 },
    });
    await r.navigate(recipes.href("recipes.index", { locale: "en-US" }));
    expect(timingsOf(ctx)["recipes.api.box"]).toEqual({ count: 2, totalMs: 30, maxMs: 15, lastMs: 15 });
    r.dispose();
  });
});
