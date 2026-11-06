import type { Ctx } from "../src/Ctx.ts";
/** Restore the capability type of a stored accessor. */
export declare function narrowAccessor<T extends object>(stored: (ctx: Ctx) => object): (ctx: Ctx) => T;
