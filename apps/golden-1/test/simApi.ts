import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { board } from "../modules/api/board.ts";
import { routes } from "../modules/api/routes.ts";
import topology from "../topology.ts";

/** Serve the real `api` deployable (createApp over the process-shared `api.board`), as server.ts does. */
export const apiApp = () =>
  createApp({ topology, routes, ctx: createCtx({ mode: "sim", seed: 7 }), deployable: "api", expose: [board] });

/**
 * A sim ctx whose net sends every `/api/*` request to the real `api` deployable, so client code gets the k.server
 * runtime `Result` bodies; `sent` records `METHOD /path` of each request. It keeps the `keel-caller` cookie the api
 * sets, as a browser would, so undo is scoped to this client (finding 0082). happy-dom drops `cookie` and
 * `set-cookie` passed at construction, but not set on the headers afterwards.
 */
export async function simApi(seed = 1) {
  const app = await apiApp();
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  let jar = "";
  ctx.net.route(new URL("/api/*", location.href).href, async (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    if (jar !== "") req.headers.set("cookie", jar);
    const res = await app.fetch(req);
    jar = res.headers.get("set-cookie")?.split(";")[0] ?? jar;
    return res;
  });
  return { ctx, sent };
}
