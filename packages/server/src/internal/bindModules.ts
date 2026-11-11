import type { Topology } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { ServerApp } from "../types/ServerApp.ts";
import { MODULES_KEY } from "./MODULES_KEY.ts";
import type { Peer } from "./Peer.ts";

/**
 * Bind `ctx` for `service({ module })` (k.topology Calls and peers): each module of the served deployable `name`
 * answers through `self`, each module of a peer through that peer (its app in process, else its URL without a trailing
 * slash). Returns the unbinding, which leaves a later `createApp`'s binding of the same ctx alone.
 */
export function bindModules(
  ctx: Ctx,
  topology: Topology,
  name: string,
  self: ServerApp,
  peers: Readonly<Record<string, Peer>>,
): () => void {
  const found: unknown = Reflect.get(globalThis, MODULES_KEY);
  const table = found instanceof WeakMap ? found : new WeakMap<Ctx, Map<string, unknown>>();
  Reflect.set(globalThis, MODULES_KEY, table);
  const map = new Map<string, string | ServerApp>();
  for (const [dep, d] of Object.entries(topology)) {
    const peer = dep === name ? self : peers[dep];
    if (peer === undefined) continue;
    const at = typeof peer === "string" || peer instanceof URL ? String(peer).replace(/\/+$/, "") : peer;
    for (const m of d.modules) map.set(m, at);
  }
  table.set(ctx, map);
  return () => {
    if (table.get(ctx) === map) table.delete(ctx);
  };
}
