import { appendChildren } from "../internal/appendChildren.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import { tagOf } from "../internal/tagOf.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

const TEXT_TAGS = ["span", "p", "strong", "em", "small", "code", "pre", "blockquote"] as const;
type TextTag = (typeof TEXT_TAGS)[number];
const TEXT_ROLES = ["status", "alert"] as const;
type TextRole = (typeof TEXT_ROLES)[number];

/**
 * Inline or block text. `as` is a closed set of text tags (default `span`), checked at runtime. `role` makes it a live
 * region (`status` or `alert`), written as the attribute at build; a `status` region is rendered from the first
 * render and its children change (E1826, k.a11y).
 */
export function Text(
  props: StyleProps & {
    readonly as?: TextTag;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    /** A live region: written as the `role` attribute, read at build. */
    readonly role?: TextRole | undefined;
    readonly children?: Child | Children | undefined;
  },
): Node {
  return make(tagOf("Text as", TEXT_TAGS, props.as, "span"), (el) => {
    applyIdLang(el, props);
    if (props.role !== undefined) el.setAttribute("role", tagOf("Text role", TEXT_ROLES, props.role));
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
  });
}
