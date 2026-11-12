import type { Href } from "@keel/router";
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

/** A link to `to` (an `Href`, required, E1802) named by its text. Unsafe schemes render `about:blank`. */
export function Link(
  props: StyleProps & {
    readonly to: Href;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    readonly children: Child | Children;
  },
): Node {
  return make("a", (el) => {
    attrOf(el, "href", isGetter(props, "to"), () => props.to);
    applyIdLang(el, props);
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
  });
}
