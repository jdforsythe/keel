import type { Href } from "@keel/router";
import { isHref } from "@keel/router/internal";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/**
 * A link to `to` (an `Href`, required, E1802) named by its text. A value that slipped past the type at run time and is
 * no `Href` (`isHref`: a scheme, `//`, a backslash, a control character) renders `about:blank`.
 */
export function Link(
  props: StyleProps & {
    readonly to: Href;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    readonly children: Child | Children;
  },
): Node {
  return make("a", (el) => {
    attrOf(el, "href", isGetter(props, "to"), () =>
      typeof props.to === "string" && isHref(props.to) ? props.to : "about:blank",
    );
    applyIdLang(el, props);
    applyStyle(el, props, "k-link");
    appendChildren(el, renderChildren(props.children));
  });
}
