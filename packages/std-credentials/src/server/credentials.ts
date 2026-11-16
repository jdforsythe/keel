import { type Ctx, register } from "@keel/ctx";
import type { Hasher } from "./Hasher.ts";
import { costOf } from "./internal/costOf.ts";
import { hasherOf } from "./internal/hasherOf.ts";
import { realEngine } from "./internal/realEngine.ts";
import { simEngine } from "./internal/simEngine.ts";

/** What the capability's factory gives: a factory sees the seed only, so cost and clock come from the accessor. */
type Maker = { make(ln: number, now: () => number): Hasher };

const access = register<Maker>("credentials", {
  real: () => ({ make: (ln, now) => hasherOf(ln, realEngine(ln), now) }),
  shell: () => ({ make: (ln, now) => hasherOf(ln, realEngine(ln), now) }),
  sim: ({ seed }) => ({ make: (ln, now) => hasherOf(ln, simEngine(seed), now) }),
});
const made = new WeakMap<Ctx, Hasher>();

/**
 * The `credentials` capability accessor: one `Hasher` per ctx, built on first use at the ctx's cost (the highest
 * `ln` any module's `std` config sets, 17 when none does) and reading `ctx.clock`.
 */
export function credentials(ctx: Ctx): Hasher {
  const known = made.get(ctx);
  if (known !== undefined) return known;
  const hasher = access(ctx).make(costOf(ctx), () => ctx.clock.now());
  made.set(ctx, hasher);
  return hasher;
}
