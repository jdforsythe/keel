import type { EndpointMap } from "./EndpointMap.ts";

/** Options for `service`: `base` URL, the `endpoints(...)` schema, and the default timeout in ms (10,000). */
export interface ServiceOptions<D extends EndpointMap> {
  readonly base: string;
  readonly schema: D;
  readonly timeout?: number;
}
