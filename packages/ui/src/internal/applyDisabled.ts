import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { attrOf } from "./attrOf.ts";
import { bound } from "./bound.ts";
import { isGetter } from "./isGetter.ts";
import { isReadable } from "./isReadable.ts";

/**
 * The `disabled` state of `el`: a signal/computed binds the `disabled` property (`el` is bound); a getter
 * prop binds the attribute; a plain `true` sets it once.
 */
export function applyDisabled(el: Element, props: { readonly disabled?: boolean | Computed<boolean> }): void {
  const disabled = props.disabled;
  if (isReadable(disabled)) {
    bound(el);
    prop(el, "disabled", () => disabled.get());
  } else attrOf(el, "disabled", isGetter(props, "disabled"), () => props.disabled === true);
}
