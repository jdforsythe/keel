import type { SimCtx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import { matchHref } from "@keel/router/match";
import type { SessionEvent } from "../SessionEvent.ts";
import { hrefOf } from "./hrefOf.ts";
import { jsonOf } from "./jsonOf.ts";
import { objectOf } from "./objectOf.ts";
import { pageOf } from "./pageOf.ts";
import { present } from "./present.ts";
import { quiet } from "./quiet.ts";

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
export async function applyInput(h: Render, routes: RouteTable, ctx: SimCtx, e: SessionEvent): Promise<boolean> {
  if (e.kind === "fire") {
    if (!present(h, e.id)) return false;
    await quiet(h.fire(e.id, e.event));
  } else if (e.kind === "nav") {
    const m = matchHref(routes, e.href);
    const page = m === null ? undefined : pageOf(routes, m.id);
    if (m === null || page === undefined) return false;
    const params = objectOf(jsonOf(m.params, page.params));
    await quiet(h.navigate(hrefOf(page.path, params, objectOf(jsonOf(m.search, page.search)))));
  } else if (e.kind === "net") {
    ctx.net.setOnline(e.online);
    await quiet(h.settle());
  }
  return true;
}
