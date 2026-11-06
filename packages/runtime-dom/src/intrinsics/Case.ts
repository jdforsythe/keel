import type { CaseNode } from "../types/CaseNode.ts";

/** `<Case tag="...">` inside `Match` (k.component). Compiler intrinsic; at runtime a case descriptor. */
export function Case<U>(props: { readonly tag: string; readonly children: (value: () => U) => Node }): CaseNode<U> {
  return { tag: props.tag, render: props.children };
}
