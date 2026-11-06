import type { Ctx } from "@keel/ctx";

/** Options for `mount`: the `ctx` (k.ctx) passed to the root component. */
export interface MountOptions {
  readonly ctx?: Ctx;
}
