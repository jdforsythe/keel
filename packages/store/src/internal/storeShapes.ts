import { type Ctx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isolate } from "../isolate.ts";
import { stores } from "../stores.ts";
import { storePayloads } from "./storePayloads.ts";
import type { StoreShape } from "./types/StoreShape.ts";

/**
 * The stores `factory` creates (k.compat Surface): it runs once with `ctx` (default a sim ctx) in a detached, isolated
 * scope, disposed after; each store's id, state schema and its transactions' payload schemas, by name.
 */
export function storeShapes(factory: (ctx: Ctx) => unknown, ctx: Ctx = createCtx({ mode: "sim" })): StoreShape[] {
  const sc = scope(() => undefined, { detached: true });
  isolate(sc);
  try {
    sc.run(() => factory(ctx));
    return [...sc.run(stores).values()].map((st) => ({
      id: st.id,
      state: st.schema,
      transactions: Object.fromEntries(storePayloads.get(st) ?? []),
    }));
  } finally {
    sc.dispose();
  }
}
