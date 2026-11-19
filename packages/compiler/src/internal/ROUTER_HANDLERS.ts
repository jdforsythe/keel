import type { HandlerKind } from "./HandlerKind.ts";

/** What `@keel/router`, or any subpath of it, exports as handlers (k.bundle Handlers). */
export const ROUTER_HANDLERS: ReadonlyMap<string, HandlerKind> = new Map<string, HandlerKind>([
  ["loader", "loader"],
  ["action", "action"],
  ["guard", "guard"],
]);
