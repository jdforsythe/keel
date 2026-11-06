import { narrow } from "../../unsafe/narrow.ts";
import { caseNode } from "../internal/caseNode.ts";
import type { CaseNode } from "../types/CaseNode.ts";
import type { Tag } from "../types/Tag.ts";
import type { Variant } from "../types/Variant.ts";

/** Props of one `Case` over union `U`: for each tag, a callback taking that variant. */
type CaseProps<U> = {
  [T in Tag<U>]: { readonly tag: T; readonly children: (value: Variant<U, T>) => Node };
}[Tag<U>];

/**
 * `<Case<State> tag="...">{(value) => ...}</Case>` inside `Match` (k.component). Compiler intrinsic; at runtime a
 * case descriptor node whose content re-renders when the matched value changes. `value` is narrowed to the
 * union variant `tag` selects (D26). Returns a JSX element.
 */
export function Case<U = unknown>(props: CaseProps<U>): CaseNode<U> {
  return caseNode({ tag: props.tag, render: (value) => props.children(narrow(value())) });
}
