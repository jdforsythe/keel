import { attr } from "@keel/runtime-dom/ops";
import { bound } from "./bound.ts";
import { classesOf } from "./classesOf.ts";
import { holdsReadable } from "./holdsReadable.ts";
import { isDynamic } from "./isDynamic.ts";
import { styleProps } from "./styleProps.ts";

/**
 * Set `el`'s class list from its style props, after its `role` class (`k-button`, `k-control`, k.ui Base) when it has one. Static props set it once; dynamic ones bind one `attr`
 * effect on `class` that switches classes; a signal or computed among them marks `el` bound (rfc:0067), a getter
 * alone does not (a compiled expression may be static). Never writes a `style` attribute.
 */
export function applyStyle(el: Element, props: Readonly<Record<string, unknown>>, role?: string): void {
  const lead = role === undefined ? [] : [role];
  if (isDynamic(props)) {
    attr(el, "class", () => {
      // Read in the binding, so a getter's reads track here and not in the render around it.
      if ([...styleProps, "states"].some((k) => holdsReadable(props[k]))) bound(el);
      const c = [...lead, ...classesOf(props)].join(" ");
      return c === "" ? null : c;
    });
    return;
  }
  const c = [...lead, ...classesOf(props)].join(" ");
  if (c !== "") el.setAttribute("class", c);
}
