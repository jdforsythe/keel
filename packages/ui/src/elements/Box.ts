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

/** A structural container. `as` is a closed set of structural tags (default `div`), checked at runtime. */
export function Box(
  props: StyleProps & {
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    readonly children?: Child | Children | undefined;
  } & Landmark,
): Node {
  return make(tagOf("Box as", BOX_TAGS, props.as, "div"), (el) => {
    applyIdLang(el, props);
    attrOf(el, "aria-label", isGetter(props, "label"), () => props.label);
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
  });
}
