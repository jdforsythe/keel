import type { Href } from "@keel/router";
import { safeUrl } from "@keel/runtime-dom/url";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A link to `to` (an `Href`, required, E1802) named by its text. Unsafe schemes render `about:blank`. */
export function Link(
  props: StyleProps & { readonly to: Href; readonly id?: string; readonly children: Child | Children },
): Node {
  return make("a", (el) => {
    el.setAttribute("href", safeUrl("href", props.to));
    if (props.id !== undefined) el.setAttribute("id", props.id);
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
  });
}
