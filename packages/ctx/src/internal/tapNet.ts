import type { Net } from "../Net.ts";
import { realmShared } from "./realmShared.ts";

/** The listeners of a tapped net, and the net's own `fetch` the tap forwards to. */
interface Tap {
  readonly seen: Set<(req: Request) => void>;
}

/**
 * Hear every `fetch` `net` is given from now until the returned stop runs (k.requests): `seen` is called with the
 * request as it entered the net, before the net answers, so a dropped, offline, 503 and unrouted request is heard as
 * any other. Not public API: `@keel/testing`'s harness log. The net's `fetch` is wrapped once; its answers are
 * untouched. A net that cannot be wrapped (a frozen driver) rejects with a `TypeError`.
 */
export function tapNet(net: Net, seen: (req: Request) => void): () => void {
  const taps = realmShared<Net, Tap>("keel.netTap");
  let tap = taps.get(net);
  if (tap === undefined) {
    const own = net.fetch;
    const made: Tap = { seen: new Set() };
    const wrapped = (req: Request): Promise<Response> => {
      for (const hear of [...made.seen]) hear(req);
      return Reflect.apply(own, net, [req]);
    };
    if (!Reflect.set(net, "fetch", wrapped)) throw new TypeError("net.fetch cannot be tapped: the net is frozen");
    taps.set(net, made);
    tap = made;
  }
  const mine = tap;
  mine.seen.add(seen);
  return () => void mine.seen.delete(seen);
}
