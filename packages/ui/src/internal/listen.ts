import { on } from "@keel/runtime-dom/ops";

/** Register `fn` for DOM event `type` on `el` through the runtime's delegated `on` (RFC 0009); no-op without `fn`. */
export function listen(el: Element, type: string, fn: ((event: Event) => void) | undefined): void {
  if (fn !== undefined) on(el, type, fn);
}
