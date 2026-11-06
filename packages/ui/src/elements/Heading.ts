import { appendChildren } from "../internal/appendChildren.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import type { Child } from "../types/Child.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/**
 * A heading; `level` (1..6) is required (E1802) and selects `h1`..`h6`. Typed `number` because generated
 * levels widen; any other value throws RangeError with `code: 'E1802'`.
 */
export function Heading(
  props: StyleProps & { readonly level: number; readonly id?: string; readonly children: Child },
): Node {
  const { level } = props;
  if (!Number.isInteger(level) || level < 1 || level > 6)
    throw Object.assign(new RangeError(`Heading level must be 1..6, got ${level}`), { code: "E1802" });
  const el = document.createElement(`h${level}`);
  if (props.id !== undefined) el.setAttribute("id", props.id);
  applyStyle(el, props);
  appendChildren(el, props.children);
  return el;
}
