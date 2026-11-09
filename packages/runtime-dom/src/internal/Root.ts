import type { Ctx } from "@keel/ctx";

/** A delegation root: one listener per bubbling event type on the mount or island element. */
export interface Root {
  /** The ctx the mount or island was given; ops report observer events on it (k.ctx Observers, rfc:0070). */
  readonly ctx: Ctx | undefined;
  listen(type: string): void;
  /** Move (or first attach) every listener to `el`. */
  attach(el: Element): void;
  dispose(): void;
}
