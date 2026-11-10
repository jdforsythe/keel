import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { make } from "../internal/make.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import { tagOf } from "../internal/tagOf.ts";
import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";
import type { StyleProps } from "../types/StyleProps.ts";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** A heading; `level` is required (E1802) and selects `h1`..`h6`; any other value throws at runtime. */
export function Heading(
  props: StyleProps & {
    readonly level: 1 | 2 | 3 | 4 | 5 | 6;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    readonly children: Child | Children;
  },
): Node {
  return make(`h${tagOf("Heading level", LEVELS, props.level)}`, (el) => {
    if (props.id !== undefined) el.setAttribute("id", props.id);
    if (props.lang !== undefined) el.setAttribute("lang", props.lang);
    applyStyle(el, props);
    appendChildren(el, renderChildren(props.children));
  });
}
