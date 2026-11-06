import { attr } from "@keel/runtime-dom/ops";
import { classesOf } from "./classesOf.ts";
import { isDynamic } from "./isDynamic.ts";

/**
 * Set `el`'s class list from its style props. Static props set it once; dynamic ones bind one `attr`
 * effect on `class` that switches classes. Never writes a `style` attribute.
 */
export function applyStyle(el: Element, props: Readonly<Record<string, unknown>>): void {
  if (isDynamic(props)) {
    attr(el, "class", () => {
      const c = classesOf(props).join(" ");
      return c === "" ? null : c;
    });
    return;
  }
  const c = classesOf(props).join(" ");
  if (c !== "") el.setAttribute("class", c);
}
