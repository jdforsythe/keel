import type { Ctx } from "@keel/ctx";
import type { RenderArtifacts } from "../types/RenderArtifacts.ts";

/** A delegation root: one listener per bubbling event type on the mount or island element. */
export interface Root {
  /** The ctx the mount or island was given; ops report observer events on it (k.ctx Observers, rfc:0070). */
  readonly ctx: Ctx | undefined;
  /** What a `mount` was given beside its ctx (`MountOptions.artifacts`), for the controls that act on its document. */
  readonly artifacts?: RenderArtifacts | undefined;
  /** Rendered in `'dev'` mode: a text binding that renders nothing warns (E1406, k.place). */
  readonly dev: boolean;
  listen(type: string): void;
  /** Report `e` to the ctx's observers as the capture tap does (once per event); for events replayed after resume. */
  tell(e: Event): void;
  /** Move (or first attach) every listener to `el`. */
  attach(el: Element): void;
  dispose(): void;
}
