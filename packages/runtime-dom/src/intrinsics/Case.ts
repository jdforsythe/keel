import type { CaseNode } from "../types/CaseNode.ts";

/**
 * `<Case tag="...">{(value) => ...}</Case>` inside `Match` (k.component). Compiler intrinsic; at runtime a
 * case descriptor whose content re-renders when the matched value changes.
 */
export function Case<U>(props: { readonly tag: string; readonly children: (value: U) => Node }): CaseNode<U> {
  return { tag: props.tag, render: (value) => props.children(value()) };
}
