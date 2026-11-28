import type { Ctx } from "@keel/ctx";
import { signerOf } from "../../unsafe/signerOf.ts";
import { MODULES_KEY } from "./MODULES_KEY.ts";

/** Whether a `createApp` bound `ctx` (its `x-keel-user` signer is there): a call on it is a server's (k.topology Calls and peers). */
export function serverBound(ctx: Ctx): boolean {
  const table: unknown = Reflect.get(globalThis, MODULES_KEY);
  const bound: unknown = table instanceof WeakMap ? table.get(ctx) : undefined;
  return bound instanceof Map && signerOf(bound.get("keel.user")) !== undefined;
}
