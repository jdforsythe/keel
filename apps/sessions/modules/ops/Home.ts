import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import type { Slots } from "@keel/runtime-dom";
import { record } from "@keel/std-sessions";
import { routes as sessions } from "@keel/std-sessions/routes";
import { Box, Heading, Link, Text } from "@keel/ui";

/**
 * Home of the ingest service (`ops.home`): what it takes and where. `ops.home.endpoint` binds the ingest URL, which
 * only the browser knows in full; that binding makes the page an island, so its resume runs in the browser with the
 * page's ctx. There it records the session and, on the first error, posts it to this service's `sessions.ingest`:
 * uploads are same-origin, so the upload URL is this page's origin. The recorder lives until its `stop()`, past this
 * component, and an error reported between the served route and this resume reaches it, since the ctx keeps the
 * errors since its current route for a new observer. A server render shows the path and records nothing, and so does a page whose origin is opaque (`about:blank`,
 * `file:`), since no URL resolves against it. A test or replay that started its own recorder keeps that one: `record`
 * returns the ctx's recorder and ignores a second `upload`. Plain `.ts` so `node server.ts` loads it.
 */
export default function Home(_props?: object, _slots?: Slots, ctx?: Ctx): Node {
  const path = sessions.href("sessions.ingest");
  const upload = typeof location === "undefined" ? null : URL.parse(path, location.origin);
  // Created with its value, never set: a render may run inside an effect, where a write is E1201.
  const endpoint = signal<string>(upload?.href ?? path);
  if (ctx !== undefined && upload !== null) record(ctx, { upload });
  return Box({
    as: "main",
    id: "ops.home",
    p: "6",
    gap: "4",
    children: () => [
      Heading({ level: 1, fontSize: "2xl", weight: "semibold", m: "0", children: "Keel sessions" }),
      Text({
        as: "p",
        id: "ops.home.intro",
        m: "0",
        children: "This service keeps recorded sessions: 64 fingerprints, the newest 5 of each, 256 KiB per session.",
      }),
      Text({ as: "p", id: "ops.home.endpoint", m: "0", font: "mono", fontSize: "sm", children: endpoint }),
      Link({ id: "ops.home.ingest", fg: "accent", to: path, children: "Ingest endpoint" }),
    ],
  });
}
