import { registerRoutes } from "./internal/registerRoutes.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteDef } from "./types/RouteDef.ts";

/**
 * Declare a module's routes (k.router Manifest). Validates the entries (throws an Error whose `code` is
 * E1502-E1506) and registers them in the process route table that `href` and `Form` read.
 */
export function manifest<M extends Readonly<Record<string, RouteDef>>>(routes: M): Manifest<M> {
  registerRoutes(routes);
  const m: Manifest<M> = { kind: "keel.manifest", routes };
  return Object.freeze(m);
}
