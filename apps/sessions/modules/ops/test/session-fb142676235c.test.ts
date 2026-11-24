// Session: fb142676235c, seed 0
import { createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp } from "@keel/server";
import { record } from "@keel/std-sessions/record";
import { routes as sessionsRoutes } from "@keel/std-sessions/routes";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import topology from "../../../topology.ts";
import { routes as opsRoutes } from "../routes.ts";

const routes = routeTable(opsRoutes, sessionsRoutes);

test("session fb142676235c", async () => {
  const ctx = createCtx({ mode: "sim", seed: 0 });
  ctx.clock.advance(1794262903390);
  const app = await createApp({ topology, deployable: "sessions", routes, ctx });
  const rec = record(ctx);
  const params = {};
  const search = {};
  const h = await renderRoute("ops.home", { routes, params, search, ctx, app });
  ctx.clock.advance(557);
  await h.fire("ops.home.limits", { type: "click" });
  expect(rec.errors()).toEqual([]);
  h.dispose();
});
