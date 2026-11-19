import type { Topology } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { ServerApp } from "../types/ServerApp.ts";
import { MODULES_KEY } from "./MODULES_KEY.ts";
import type { Peer } from "./Peer.ts";

/** Signs a module call's `x-keel-user` for the deployable `to` that serves it (k.user User header). */
type Sign = (to: string, method: string, url: string, user: string, body: string | Uint8Array) => string | undefined;

/**
 * Bind `ctx` for `service({ module })` (k.topology Calls and peers): each module of the served deployable `name`
 * answers through `self`, each module of a peer through that peer (its app in process, else its URL without a trailing
 * slash), and `"keel.user"`, no module id, holds the `x-keel-user` signer a call to a module's URL carries for a user
 * (k.user Across deployables): it signs for the deployable that serves the module, the peer's key, or `own` (this
 * server's `createApp({ deployable })`, else `""`) for a module served here. Returns the unbinding, which leaves a later
 * `createApp`'s binding of the same ctx alone.
 */
export function bindModules(
  ctx: Ctx,
  topology: Topology,
  name: string,
  own: string,
  self: ServerApp,
  peers: Readonly<Record<string, Peer>>,
  sign: Sign,
): () => void {
  const found: unknown = Reflect.get(globalThis, MODULES_KEY);
  const table = found instanceof WeakMap ? found : new WeakMap<Ctx, Map<string, unknown>>();
  Reflect.set(globalThis, MODULES_KEY, table);
  const servedBy = new Map<string, string>();
  const signer = (module: string, method: string, url: string, user: string, body: string | Uint8Array) =>
    sign(servedBy.get(module) ?? "", method, url, user, body);
  const map = new Map<string, string | ServerApp | typeof signer>([["keel.user", signer]]);
  for (const [dep, d] of Object.entries(topology)) {
    for (const m of d.modules) servedBy.set(m, dep === name ? own : dep);
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
