import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { isReadable } from "./isReadable.ts";

/** Set the `disabled` attribute once, or bind the `disabled` property to a signal/computed. */
export function applyDisabled(el: Element, disabled: boolean | Computed<boolean> | undefined): void {
  if (isReadable(disabled)) prop(el, "disabled", () => disabled.get());
  else if (disabled === true) el.setAttribute("disabled", "");
}
