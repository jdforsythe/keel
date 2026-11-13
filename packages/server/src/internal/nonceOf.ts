import type { Ctx } from "@keel/ctx";

/** A fresh document nonce (k.security Policy): two `ctx.random.id("Nonce")` values without hyphens, 64 hex characters. */
export function nonceOf(ctx: Ctx): string {
  return `${ctx.random.id("Nonce")}${ctx.random.id("Nonce")}`.replaceAll("-", "");
}
