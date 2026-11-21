import { type SimCtx, createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp } from "@keel/server";
import { routes as app } from "../modules/app/routes.ts";
import { routes as receipts } from "../modules/receipts/routes.ts";
import { routes as setup } from "../modules/setup/routes.ts";
import { routes as shopping } from "../modules/shopping/routes.ts";
import topology from "../topology.ts";

/** The `web` deployable's route table, as its generated entry joins it. */
export const webRoutes = routeTable(app, receipts, setup, shopping);

/**
 * A sim ctx whose net answers every request with the `web` deployable served over that same ctx, so a page under
 * `renderRoute` and the API its guard and components call share one `ctx.storage`. A service call made on this ctx
 * runs in process; `sent` lists `METHOD /path` of what reached the net.
 */
export async function served(
  seed = 1,
): Promise<{ ctx: SimCtx; sent: string[]; fetch: (r: Request) => Promise<Response> }> {
  const ctx = createCtx({ mode: "sim", seed });
  const web = await createApp({ topology, routes: webRoutes, ctx, deployable: "web" });
  const sent: string[] = [];
  const answer = (req: Request) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    return web.fetch(req);
  };
  ctx.net.route(new URL("/api/*", location.href).href, answer);
  ctx.net.route("http://setup.keel.invalid/*", answer);
  ctx.net.route("http://shopping.keel.invalid/*", answer);
  return { ctx, sent, fetch: answer };
}

/** A JSON request as a services client sends it. */
export const asJson = (method: string, path: string, body?: unknown): Request =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
