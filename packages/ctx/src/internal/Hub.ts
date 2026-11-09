import type { CtxEvent } from "../CtxEvent.ts";

/** One ctx's observers in registration order and the last `nav` reported (replayed to a new observer). */
export interface Hub {
  readonly fns: ((event: CtxEvent) => void)[];
  nav: (CtxEvent & { readonly kind: "nav" }) | undefined;
}
