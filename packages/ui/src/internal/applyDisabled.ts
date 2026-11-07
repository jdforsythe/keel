import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { bound } from "./bound.ts";
import { isReadable } from "./isReadable.ts";

/** Set the `disabled` attribute once, or bind the `disabled` property to a signal/computed (`el` is bound, rfc:0067). */
export function applyDisabled(el: Element, disabled: boolean | Computed<boolean> | undefined): void {
  if (isReadable(disabled)) {
    bound(el);
    prop(el, "disabled", () => disabled.get());
  } else if (disabled === true) el.setAttribute("disabled", "");
}
