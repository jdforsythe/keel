import type { Computed } from "@keel/reactive";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { listen } from "../internal/listen.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/**
 * A button named by its children (required, E1802): text, or an `Image` whose `alt` names it. There is no `label`
 * (RFC 0043). `type` defaults to `button`; `disabled` may be reactive.
 */
export function Button(
  props: StyleProps & {
    readonly type?: "button" | "submit" | "reset";
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    readonly disabled?: boolean | Computed<boolean>;
    /** Called on click (RFC 0009). */
    readonly onClick?: () => void;
    readonly children: Child | Children;
  },
): Node {
  return make("button", (el) => {
    attrOf(el, "type", isGetter(props, "type"), () => props.type ?? "button");
    applyIdLang(el, props);
    applyDisabled(el, props);
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
    listen(el, "click", props.onClick);
  });
}
