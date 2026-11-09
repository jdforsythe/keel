import type { CtxEvent } from "../CtxEvent.ts";

/**
 * One ctx's observers in registration order, the last `nav` reported, and the `error` events reported since it (the
 * first `KEPT_ERRORS`); a new observer gets that `nav`, then those errors.
 */
export interface Hub {
  readonly fns: ((event: CtxEvent) => void)[];
  nav: (CtxEvent & { readonly kind: "nav" }) | undefined;
  errors: (CtxEvent & { readonly kind: "error" })[];
}
