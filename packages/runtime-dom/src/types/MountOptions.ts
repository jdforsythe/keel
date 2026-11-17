import type { Ctx } from "@keel/ctx";
import type { UnexpectedError } from "./UnexpectedError.ts";

/** Options for `mount`: the `ctx` (k.ctx) passed to the root component, the root Boundary's error hook, and `mode`. */
export interface MountOptions {
  readonly ctx?: Ctx;
  /** Called with the error the default root Boundary caught, after its fallback is built (harness hook). */
  readonly onError?: (error: UnexpectedError) => void;
  /** The root fallback shows the error's message only in `dev`; `production` (the default) shows `keel.unexpected`. */
  readonly mode?: "dev" | "production";
}
