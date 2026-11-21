import { type SimCtx, createCtx } from "@keel/ctx";
import { createApp, identity } from "@keel/server";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";

/** 2026-11-10T09:30:00.000Z, the api's sim clock in every test: recipes added now are dated 2026-11-10. */
export const NOW = 1794303000000;

/** A sim ctx for the api deployable whose clock reads `NOW`. */
export const apiCtx = (seed = 7): SimCtx => {
  const ctx = createCtx({ mode: "sim", seed });
  ctx.clock.advance(NOW);
  return ctx;
};

/** An identity source that names `user` for every request (`''` for no one). */
export const asUser = (user: string) => identity({ identify: async () => user });

/** Serve the real `api` deployable over `server`'s sim ctx (its storage is the box's persistence), every request made by `user` (`''` for no one). */
export const apiApp = (server: SimCtx, user = "tester") =>
  createApp({ topology, routes: apiRoutes, ctx: server, deployable: "api", identity: asUser(user) });

/** A JSON request as a services client sends it. */
export const asJson = (method: string, path: string, body?: unknown): Request =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** A draft as the api takes it: `minutes` and a price in minor units. */
export const draft = (title: string, minutes: number, amount = 1250, currency = "EUR") => ({
  title,
  minutes,
  price: { amount, currency },
});

/**
 * A client sim ctx whose net sends every `/api/*` request to a fresh `api` deployable; `sent` records `METHOD /path`
 * of each request and `app` lets a test seed the box through the api itself.
 */
export async function simApi(seed = 1) {
  const app = await apiApp(apiCtx());
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  ctx.net.route(new URL("/api/*", location.href).href, (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    return app.fetch(req);
  });
  return { ctx, sent, app };
}
