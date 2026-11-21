import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";
import { openHeld } from "./openHeld.ts";
import type { Factory } from "./types/Factory.ts";
import type { StateRequest } from "./types/StateRequest.ts";

/** This request's instance of `factory` (k.server Server state): opened once per request (`openHeld`), then reused. */
export function openStores(
  ctx: Ctx,
  rq: StateRequest,
  factory: Factory,
  seen?: (schema: Schema<unknown>, state: unknown) => void,
): Promise<unknown> {
  const held = rq.held.get(factory) ?? openHeld(ctx, rq, factory, seen);
  return held.then((h) => h.value);
}
