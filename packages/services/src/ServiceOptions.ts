import type { Contract } from "@keel/router/contract";
import type { EndpointMap } from "./EndpointMap.ts";

/**
 * Options for `service`: a module's `contract`, whose API entries k.topology resolves (in process, a peer, the
 * document's origin in a browser, `http://<module>.keel.invalid` on a ctx no `createApp` bound), or another service's
 * absolute `base` URL with its `endpoints(...)` `schema`; the default `timeout` in ms (10,000); and `maxBytes`, the
 * most of a response body a call reads (1 MiB).
 */
export type ServiceOptions<D extends EndpointMap = EndpointMap, C extends Contract = Contract> =
  | {
      readonly contract: C;
      readonly timeout?: number;
      readonly maxBytes?: number;
      readonly base?: undefined;
      readonly schema?: undefined;
    }
  | {
      readonly base: string;
      readonly schema: D;
      readonly timeout?: number;
      readonly maxBytes?: number;
      readonly contract?: undefined;
    };
