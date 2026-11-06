import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import type { Child } from "../types/Child.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type Name =
  | { readonly children: Child; readonly label?: string }
  | { readonly label: string; readonly children?: Child };

/**
 * A button named by its text or `label` (one is required, E1802). With children, `label` becomes
 * `aria-label`; without, `label` is the visible text. `type` defaults to `button`.
 */
export function Button(
  props: StyleProps & { readonly type?: "button" | "submit" | "reset"; readonly id?: string } & Name,
): Node {
  const el = document.createElement("button");
  el.setAttribute("type", props.type ?? "button");
  if (props.id !== undefined) el.setAttribute("id", props.id);
  applyStyle(el, props);
  if (props.children === undefined) appendChildren(el, props.label);
  else {
    if (props.label !== undefined) el.setAttribute("aria-label", props.label);
    appendChildren(el, props.children);
  }
  return el;
}
