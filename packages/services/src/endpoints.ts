import type { EndpointMap } from "./EndpointMap.ts";

/** Declare a service's endpoints (k.services). Returns the frozen declarations; types are kept literal. */
export function endpoints<const D extends EndpointMap>(decls: D): D {
  return Object.freeze(decls);
}
