import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A heading; `level` is required (E1802) and selects `h1`..`h6`. */
export function Heading(
  props: StyleProps & {
    readonly level: 1 | 2 | 3 | 4 | 5 | 6;
    readonly id?: string;
    readonly children: Child | Children;
  },
): Node {
  const el = document.createElement(`h${props.level}`);
  if (props.id !== undefined) el.setAttribute("id", props.id);
  applyStyle(el, props);
  appendChildren(el, renderChildren(props.children));
  return el;
}
