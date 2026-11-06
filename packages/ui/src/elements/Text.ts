import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import type { Child } from "../types/Child.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type TextTag = "span" | "p" | "strong" | "em" | "small" | "code" | "pre" | "blockquote";

/** Inline or block text. `as` is a closed set of text tags (default `span`). */
export function Text(
  props: StyleProps & { readonly as?: TextTag; readonly id?: string; readonly children?: Child },
): Node {
  const el = document.createElement(props.as ?? "span");
  if (props.id !== undefined) el.setAttribute("id", props.id);
  applyStyle(el, props);
  appendChildren(el, props.children);
  return el;
}
