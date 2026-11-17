import type { Ctx } from "@keel/ctx";
import type { Restorable } from "./Restorable.ts";

/** Options for `resume`: the `ctx` (k.ctx) passed to every island root, stores to restore by id, and `mode`. */
export interface ResumeOptions {
  readonly ctx?: Ctx;
  readonly stores?: Readonly<Record<string, Restorable>>;
  /** An island's root fallback shows the error's message only in `dev`; `production` (the default) shows `keel.unexpected`. */
  readonly mode?: "dev" | "production";
}
