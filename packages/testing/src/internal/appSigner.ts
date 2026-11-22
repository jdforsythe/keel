import type { Ctx } from "@keel/ctx";
import type { DocumentApp } from "../types/DocumentApp.ts";
import { fail } from "./fail.ts";

/** The key of the bindings `createApp` writes on a ctx (`@keel/services`' `MODULES_KEY`). */
const MODULES_KEY = Symbol.for("keel.modules");

/**
 * The `x-keel-user` signer for `user` on a page `app` serves (k.user Testing): the `keel.user` signer of the binding
 * `createApp` made of `app` on `ctx`, signing for a module `app` serves. A `ctx` whose binding does not hold `app`
 * rejects E1724, before any request.
 */
export function appSigner(
  ctx: Ctx,
  app: DocumentApp,
  id: string,
  user: string,
): (method: string, url: string, body: Uint8Array) => string | undefined {
  const table: unknown = Reflect.get(globalThis, MODULES_KEY);
  const bound: unknown = table instanceof WeakMap ? table.get(ctx) : undefined;
  const entries = bound instanceof Map ? [...bound] : [];
  const module = entries.find(([, v]) => v === app)?.[0];
  const signer: unknown = bound instanceof Map ? bound.get("keel.user") : undefined;
  if (typeof module !== "string" || typeof signer !== "function")
    throw fail(
      "E1724",
      `renderRoute(${JSON.stringify(id)}): user needs the ctx createApp made app on; no binding of app holds a signer`,
      { user },
    );
  return (method, url, body) => {
    const signed: unknown = Reflect.apply(signer, undefined, [module, method, url, user, body]);
    return typeof signed === "string" ? signed : undefined;
  };
}
