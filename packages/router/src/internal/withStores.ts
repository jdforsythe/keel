import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isolate } from "@keel/store";

/**
 * `use` called with the `stores` a direct `run` gets (k.server API): `given` when the caller passed one; else, with a
 * `factory`, what it returns for `ctx`, made in a detached scope with its own store registry and disposed once `use`
 * settles; else `undefined`. Nothing is saved.
 */
export async function withStores<S, R>(
  factory: ((ctx: Ctx) => S) | undefined,
  given: S | undefined,
  ctx: Ctx,
  use: (stores: S | undefined) => R | Promise<R>,
): Promise<R> {
  if (given !== undefined || factory === undefined) return use(given);
  const sc = scope(() => undefined, { detached: true });
  isolate(sc);
  try {
    return await use(sc.run(() => factory(ctx)));
  } finally {
    sc.dispose();
  }
}
