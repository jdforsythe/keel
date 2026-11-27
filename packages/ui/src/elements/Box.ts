import { USES_SCHEME } from "../internal/USES_SCHEME.ts";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import { tagOf } from "../internal/tagOf.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

const BOX_TAGS = ["div", "section", "nav", "main", "header", "footer", "aside", "article", "ul", "ol", "li"] as const;

/**
 * `label` names a landmark (written as `aria-label`): required on `nav` and `aside`, which a page repeats (E1802),
 * optional on `section`, `main`, `header` and `footer`, refused on generic and list tags.
 */
type Landmark =
  | { readonly as: "nav" | "aside"; readonly label: string }
  | { readonly as: "section" | "main" | "header" | "footer"; readonly label?: string }
  | { readonly as?: "div" | "ul" | "ol" | "li" | "article"; readonly label?: never };

/**
 * `scroll="x"` makes the box a keyboard-reachable scroll region: a `div` with `role="region"`, `tabindex="0"` and
 * class `k-scroll`, named by exactly one of `label` and `labelledBy` (an element id), with no `as`.
 */
type ScrollRegion =
  | { readonly scroll: "x"; readonly label: string; readonly labelledBy?: never; readonly as?: never }
  | { readonly scroll: "x"; readonly labelledBy: string; readonly label?: never; readonly as?: never };

/** A structural container. `as` is a closed set of structural tags (default `div`), checked at runtime. */
export function Box(
  props: StyleProps & {
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    readonly children?: Child | Children | undefined;
    /** Fixes the scheme of this element and what it holds on screen (k.aria Scheme), written as `data-k-scheme`. */
    readonly scheme?: "light" | "dark";
  } & ((Landmark & { readonly scroll?: undefined; readonly labelledBy?: undefined }) | ScrollRegion),
): Node {
  const scroll = props.scroll === "x";
  return make(scroll ? "div" : tagOf("Box as", BOX_TAGS, props.as, "div"), (el) => {
    applyIdLang(el, props);
    if (scroll) {
      el.setAttribute("role", "region");
      el.setAttribute("tabindex", "0");
      attrOf(el, "aria-labelledby", isGetter(props, "labelledBy"), () => props.labelledBy);
    }
    attrOf(el, "aria-label", isGetter(props, "label"), () => props.label);
    if (USES_SCHEME && (props.scheme === "light" || props.scheme === "dark"))
      el.setAttribute("data-k-scheme", props.scheme);
    applyStyle(el, props, scroll ? "k-scroll" : undefined);
    appendChildren(el, renderChildren(props.children));
  });
}
