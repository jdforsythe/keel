import type { Ctx } from "@keel/ctx";
import { MODULES_KEY } from "./MODULES_KEY.ts";
import type { Target } from "./Target.ts";
import { isFetcher } from "./isFetcher.ts";

/**
 * Resolve `service({ module })` for one call (k.topology Calls and peers): on a ctx a `createApp` bound, the app that
 * serves `module` in this process answers through its `fetch`, and a peer by URL through `ctx.net.fetch`; otherwise a
 * browser calls the document's origin and anything else `http://<module>.keel.invalid`, both through `ctx.net.fetch`.
 */
export function moduleTarget(ctx: Ctx, module: string): Target {
  const net = (base: string): Target => ({ base, send: (req) => ctx.net.fetch(req) });
  const table: unknown = Reflect.get(globalThis, MODULES_KEY);
  const bound: unknown = table instanceof WeakMap ? table.get(ctx) : undefined;
  const at: unknown = bound instanceof Map ? bound.get(module) : undefined;
  if (typeof at === "string") return net(at);
  if (isFetcher(at)) return { base: `http://${module}.keel.invalid`, send: (req) => at.fetch(req) };
  const loc: unknown = Reflect.get(globalThis, "location");
  const origin: unknown = typeof loc === "object" && loc !== null ? Reflect.get(loc, "origin") : undefined;
  if (bound === undefined && typeof origin === "string" && /^https?:\/\//.test(origin)) return net(origin);
  return net(`http://${module}.keel.invalid`);
}
