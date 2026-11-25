import type { Ctx } from "../src/Ctx.ts";
import { unsafe } from "./unsafe.ts";

/** Restore the capability type of a stored accessor. */
export function narrowAccessor<T extends object>(stored: (ctx: Ctx) => object): (ctx: Ctx) => T {
  return unsafe(
    "register returns this only when the name's stored impls object is the identical one, and that object fixed T when the accessor was stored",
    () => {
      return stored as (ctx: Ctx) => T;
    },
  );
}
