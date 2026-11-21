import type { Ctx } from "@keel/ctx";

const sets = new WeakMap<Ctx, Set<string>>();

/**
 * The ids of every field that was ever a password field under `ctx` (red-team 0207), created on first use: a
 * show-password toggle sets `type="text"`, and the field stays masked for the rest of the ctx.
 */
export function secretsOf(ctx: Ctx): Set<string> {
  const known = sets.get(ctx);
  if (known !== undefined) return known;
  const made = new Set<string>();
  sets.set(ctx, made);
  return made;
}
