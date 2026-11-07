import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import { tagOf } from "../internal/tagOf.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

const TEXT_TAGS = ["span", "p", "strong", "em", "small", "code", "pre", "blockquote"] as const;
type TextTag = (typeof TEXT_TAGS)[number];

/** Inline or block text. `as` is a closed set of text tags (default `span`), checked at runtime. */
export function Text(
  props: StyleProps & { readonly as?: TextTag; readonly id?: string; readonly children?: Child | Children | undefined },
): Node {
  return make(tagOf("Text as", TEXT_TAGS, props.as, "span"), (el) => {
    if (props.id !== undefined) el.setAttribute("id", props.id);
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
  });
}
