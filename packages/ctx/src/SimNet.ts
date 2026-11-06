import type { Net } from "./Net.ts";
import type { RouteHandler } from "./RouteHandler.ts";

/**
 * Simulated network: an in-memory route table. `pattern` is an exact URL, or a URL prefix ending in `*`.
 * First registered match wins; unmatched requests get a deterministic 404.
 */
export interface SimNet extends Net {
  route(pattern: string, handler: RouteHandler): void;
}
