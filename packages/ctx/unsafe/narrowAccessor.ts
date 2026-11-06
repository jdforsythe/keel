import type { Ctx } from "../src/Ctx.ts";
import { unsafe } from "./unsafe.ts";

/** Restore the capability type of a stored accessor. */
export function narrowAccessor<T extends object>(stored: (ctx: Ctx) => object): (ctx: Ctx) => T {
  return unsafe("registry stores accessors type-erased; same name and identical impls object imply the same T", () => {
    return stored as (ctx: Ctx) => T;
  });
}
