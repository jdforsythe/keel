import type { Ctx } from "@keel/ctx";
import type { StdData } from "../types/StdData.ts";

/** The `std.json` data `createApp({ ctx, std })` bound to each ctx (rfc:0066); `stdConfig` reads it. Not a ctx property. */
export const stdBindings: WeakMap<Ctx, StdData> = new WeakMap();
