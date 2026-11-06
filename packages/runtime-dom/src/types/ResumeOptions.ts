import type { Ctx } from "@keel/ctx";
import type { Restorable } from "./Restorable.ts";

/** Options for `resume`: the `ctx` (k.ctx) passed to every island root, and stores to restore by id. */
export interface ResumeOptions {
  readonly ctx?: Ctx;
  readonly stores?: Readonly<Record<string, Restorable>>;
}
