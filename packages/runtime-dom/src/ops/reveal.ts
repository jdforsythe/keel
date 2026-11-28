import { revealed } from "../internal/revealed.ts";
import { serverMode } from "../internal/serverMode.ts";

/**
 * Build `el` `hidden`: the server's HTML keeps it hidden, so a page with no script shows nothing of it; the `mount` or
 * `resume` that builds it in the browser removes the attribute when it ends (k.schemes Choice).
 */
export function reveal(el: Element): void {
  el.setAttribute("hidden", "");
  if (!serverMode.on) revealed.push(el);
}
