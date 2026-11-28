import type { Ctx } from "@keel/ctx";
import type { Live } from "./Live.ts";

/** The active recorder of each ctx: `record` returns it again until `stop()`. */
export const actives: WeakMap<Ctx, Live> = new WeakMap();
