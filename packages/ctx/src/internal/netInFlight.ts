import { realmShared } from "./realmShared.ts";

/**
 * The route calls a sim net is running now: a request past its step's delay whose route has not answered yet (a route
 * awaiting real I/O, such as a server on another ctx). 0 for any other net. Read by `simulate`'s `run()` (k.sim), which
 * settles only once none is in flight. An answered route's open body is no request in flight.
 */
export function netInFlight(net: object): number {
  return realmShared<object, () => number>("keel.netInFlight").get(net)?.() ?? 0;
}
