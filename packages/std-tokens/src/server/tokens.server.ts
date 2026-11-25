import { type Ctx, register } from "@keel/ctx";
import type { Tokens } from "./Tokens.type.ts";
import { realEngine } from "./internal/realEngine.server.ts";
import { simEngine } from "./internal/simEngine.server.ts";
import { tokensOf } from "./internal/tokensOf.server.ts";

/** What the capability's factory gives: a factory sees the seed only, so the clock comes from the accessor. */
type Maker = { make(now: () => number): Tokens };

const access = register<Maker>("tokens", {
  real: () => ({ make: (now) => tokensOf(realEngine(), now) }),
  shell: () => ({ make: (now) => tokensOf(realEngine(), now) }),
  sim: ({ seed }) => {
    const engine = simEngine(seed);
    return { make: (now) => tokensOf(engine, now) };
  },
});
const made = new WeakMap<Ctx, Tokens>();

/** The `tokens` capability accessor: one `Tokens` per ctx, reading `ctx.clock`. */
export function tokens(ctx: Ctx): Tokens {
  const known = made.get(ctx);
  if (known !== undefined) return known;
  const fresh = access(ctx).make(() => ctx.clock.now());
  made.set(ctx, fresh);
  return fresh;
}
