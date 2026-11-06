import type { RouteHandler } from "../RouteHandler.ts";
import type { SimNet } from "../SimNet.ts";
import { matchRoute } from "./matchRoute.ts";

/** In-memory route table. Unmatched requests resolve a 404 whose body names the URL. */
export function simNet(): SimNet {
  const routes: { readonly pattern: string; readonly handler: RouteHandler }[] = [];
  return {
    route: (pattern, handler) => {
      routes.push({ pattern, handler });
    },
    fetch: async (req) => {
      const hit = routes.find((r) => matchRoute(r.pattern, req.url));
      if (hit) return hit.handler(req);
      return new Response(`sim net: no route for ${req.method} ${req.url}`, { status: 404 });
    },
  };
}
