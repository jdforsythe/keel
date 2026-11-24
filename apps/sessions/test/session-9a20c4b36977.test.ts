// Session: 9a20c4b36977, seed 1337
import { createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp } from "@keel/server";
import { record } from "@keel/std-sessions/record";
import { routes as sessionsRoutes } from "@keel/std-sessions/routes";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { routes as opsRoutes } from "../modules/ops/routes.ts";
import topology from "../topology.ts";

const routes = routeTable(opsRoutes, sessionsRoutes);

test("session 9a20c4b36977", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.clock.advance(1);
  const app = await createApp({ topology, deployable: "sessions", routes, ctx });
  const rec = record(ctx);
  const params = {};
  const search = {};
  const h = await renderRoute("ops.home", { routes, params, search, ctx, app });
  expect(rec.errors()).toEqual([]);
  h.dispose();
});
