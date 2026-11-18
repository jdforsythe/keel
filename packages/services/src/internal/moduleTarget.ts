import type { Ctx } from "@keel/ctx";
import { MODULES_KEY } from "./MODULES_KEY.ts";
import type { Target } from "./Target.ts";
import { isFetcher } from "./isFetcher.ts";
import { isSigner } from "./isSigner.ts";

/**
 * Resolve `service({ module })` for one call (k.topology Calls and peers, k.hosting Peers): on a ctx a `createApp` or
 * a `client` entry bound, the app that serves `module` in this process answers through its `fetch`, and an origin by
 * URL (a peer's, or the `keel-peer` tag's in a browser) through `ctx.net.fetch`; otherwise a browser calls the
 * document's origin and anything else `http://<module>.keel.invalid`, both through `ctx.net.fetch`. In a browser a
 * call to an origin other than the document's is sent with `credentials: "include"`.
 * Over the net a redirect is not followed (`redirect: "manual"`): a 3xx is `api.status` as it is in process.
 * A `createApp`'s binding also gives the target its `x-keel-user` signer (k.user Across deployables).
 */
export function moduleTarget(ctx: Ctx, module: string): Target {
  const loc: unknown = Reflect.get(globalThis, "location");
  const found: unknown = typeof loc === "object" && loc !== null ? Reflect.get(loc, "origin") : undefined;
  const origin = typeof found === "string" && /^https?:\/\//.test(found) ? found : undefined;
  const table: unknown = Reflect.get(globalThis, MODULES_KEY);
  const bound: unknown = table instanceof WeakMap ? table.get(ctx) : undefined;
  const signer = bound instanceof Map ? bound.get("keel.user") : undefined;
  const sign = isSigner(signer) ? signer : undefined;
  const net = (base: string): Target => {
    const cross = origin !== undefined && base !== origin && !base.startsWith(`${origin}/`);
    return {
      base,
      module: true,
      sign,
      send: (req) =>
        ctx.net.fetch(
          new Request(req, cross ? { redirect: "manual", credentials: "include" } : { redirect: "manual" }),
        ),
    };
  };
  const at: unknown = bound instanceof Map ? bound.get(module) : undefined;
  if (typeof at === "string") return net(at);
  if (isFetcher(at)) return { base: `http://${module}.keel.invalid`, module: true, sign, send: (req) => at.fetch(req) };
  if (bound === undefined && origin !== undefined) return net(origin);
  return net(`http://${module}.keel.invalid`);
}
