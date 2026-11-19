import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import type { Channel } from "../Channel.type.ts";
import { eventsOf } from "./eventsOf.ts";

/** The k.services client of a channel at `origin`: its event stream and its publish, both on the channel's path. */
export function apiOf<P, M>(origin: string, ch: Channel<P, M>) {
  return service({
    base: origin,
    schema: endpoints({
      events: { method: "GET", path: ch.path, query: ch.params, output: eventsOf(ch.message), events: true },
      publish: {
        method: "POST",
        path: ch.path,
        query: ch.params,
        body: s.object({ message: ch.message ?? s.json() }),
        output: s.object({ ok: s.literal(true) }),
      },
    }),
  });
}
