import type { Endpoint } from "./Endpoint.ts";

/** A named set of endpoint declarations, as returned by `endpoints(...)`; one client method per key. */
export type EndpointMap = Readonly<Record<string, Endpoint>>;
