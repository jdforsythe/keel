import { on } from "@keel/runtime-dom/ops";
import { bound } from "./bound.ts";

/**
 * Register `fn` for DOM event `type` on `el` through the runtime's delegated `on` (RFC 0009), marking `el` bound
 * (rfc:0067); no-op without `fn`.
 */
export function listen(el: Element, type: string, fn: ((event: Event) => void) | undefined): void {
  if (fn === undefined) return;
  bound(el);
  on(el, type, fn);
}
