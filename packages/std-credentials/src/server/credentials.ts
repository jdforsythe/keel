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
  sim: ({ seed }) => {
    const engine = simEngine(seed);
    return { make: (ln, now) => hasherOf(ln, engine, now) };
  },
});
const made = new WeakMap<Ctx, { readonly ln: number; readonly hasher: Hasher }>();

/**
 * The `credentials` capability accessor: a `Hasher` per ctx at the ctx's cost (the highest `ln` any module's `std`
 * config sets, 17 when none does), read at each access, reading `ctx.clock`. A changed cost builds a new `Hasher`;
 * under sim it keeps the ctx's call count.
 */
export function credentials(ctx: Ctx): Hasher {
  const ln = costOf(ctx);
  const known = made.get(ctx);
  if (known !== undefined && known.ln === ln) return known.hasher;
  const hasher = access(ctx).make(ln, () => ctx.clock.now());
  made.set(ctx, { ln, hasher });
  return hasher;
}
