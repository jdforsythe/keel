import type { SurfaceRoute } from "./SurfaceRoute.ts";
import { samePath } from "./samePath.ts";

/** The route of `module` an endpoint `method path` reaches (k.compat Endpoints): GET and HEAD the loader, others an action. */
export function routeFor(
  routes: readonly SurfaceRoute[],
  module: string,
  method: string,
  path: string,
): SurfaceRoute | undefined {
  const read = method === "GET" || method === "HEAD";
  return routes.find((r) => r.module === module && samePath(r.path, path) && (read || r.actions.has(method)));
}
