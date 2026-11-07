import { type SimCtx, createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { routes } from "../modules/kitchen/routes.ts";
import topology from "../topology.ts";

/** Serve the real `api` deployable over `server`'s sim ctx (its storage is the box's persistence). */
export const apiApp = (server: SimCtx) => createApp({ topology, routes, ctx: server, deployable: "api" });

/** A JSON request as a services client sends it. */
export const asJson = (method: string, path: string, body?: unknown): Request =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/**
 * A client sim ctx whose net sends every `/api/*` request to a fresh `api` deployable; `sent` records `METHOD /path`
 * of each request and `app` lets a test seed the box through the api itself.
 */
export async function simApi(seed = 1) {
  const app = await apiApp(createCtx({ mode: "sim", seed: 7 }));
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  ctx.net.route(new URL("/api/*", location.href).href, (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    return app.fetch(req);
  });
  return { ctx, sent, app };
}
