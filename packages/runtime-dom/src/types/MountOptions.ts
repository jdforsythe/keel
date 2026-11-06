import type { Ctx } from "@keel/ctx";
import type { UnexpectedError } from "./UnexpectedError.ts";

/** Options for `mount`: the `ctx` (k.ctx) passed to the root component, and the root Boundary's error hook. */
export interface MountOptions {
  readonly ctx?: Ctx;
  /** Called with the error the default root Boundary caught, after its fallback is built (harness hook). */
  readonly onError?: (error: UnexpectedError) => void;
}
