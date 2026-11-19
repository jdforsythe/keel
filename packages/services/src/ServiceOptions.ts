import type { EndpointMap } from "./EndpointMap.ts";

/**
 * Options for `service`: the `endpoints(...)` schema, the default timeout in ms (10,000), and where calls go: `base`,
 * another service's absolute URL, or `module`, an app module whose routes k.topology resolves (in process, a peer, the
 * document's origin in a browser, `http://<module>.keel.invalid` on a ctx no `createApp` bound).
 */
export type ServiceOptions<D extends EndpointMap> = {
  readonly schema: D;
  readonly timeout?: number;
} & ({ readonly base: string; readonly module?: undefined } | { readonly module: string; readonly base?: undefined });
