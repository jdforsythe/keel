import type { SimCtx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import { matchHref } from "@keel/router/match";
import type { SessionEvent } from "../SessionEvent.ts";
import { present } from "./present.ts";
import { quiet } from "./quiet.ts";

type Table = Manifest<Readonly<Record<string, RouteDef>>>;
type Render = {
  find(id: string): unknown;
  fire(id: string, event: Extract<SessionEvent, { kind: "fire" }>["event"]): Promise<void>;
  navigate(href: string): Promise<void>;
  settle(): Promise<void>;
};

/**
 * Apply one recorded event to a replay (std.sessions `replay`): a `fire` on its element, a `nav` through `navigate`,
 * a `net` through the sim net's `setOnline`; any other event is an observation and applies as nothing. False when the
 * input cannot apply (its element is gone, its href matches no route).
 */
export async function applyInput(h: Render, routes: Table, ctx: SimCtx, e: SessionEvent): Promise<boolean> {
  if (e.kind === "fire") {
    if (!present(h, e.id)) return false;
    await quiet(h.fire(e.id, e.event));
  } else if (e.kind === "nav") {
    const m = matchHref(routes, e.href);
    if (m === null) return false;
    await quiet(h.navigate(routes.href(m.id, m.params, m.search)));
  } else if (e.kind === "net") {
    ctx.net.setOnline(e.online);
    await quiet(h.settle());
  }
  return true;
}
