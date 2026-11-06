import type { Ctx } from "@keel/ctx";
import type { Store } from "@keel/store";

/** Options of `render`: `props` and every `[store, value]` in `state` are parsed by their schemas first. */
export interface RenderOptions {
  readonly props: unknown;
  readonly state?: readonly (readonly [Store<unknown>, unknown])[];
  readonly ctx?: Ctx;
}
