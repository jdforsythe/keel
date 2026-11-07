import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import { tagOf } from "../internal/tagOf.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

const BOX_TAGS = ["div", "section", "nav", "main", "header", "footer", "aside", "article", "ul", "ol", "li"] as const;
type BoxTag = (typeof BOX_TAGS)[number];

/** A structural container. `as` is a closed set of structural tags (default `div`), checked at runtime. */
export function Box(
  props: StyleProps & { readonly as?: BoxTag; readonly id?: string; readonly children?: Child | Children | undefined },
): Node {
  const el = document.createElement(tagOf("Box as", BOX_TAGS, props.as, "div"));
  if (props.id !== undefined) el.setAttribute("id", props.id);
  applyStyle(el, props);
  appendChildren(el, renderChildren(props.children));
  return el;
}
