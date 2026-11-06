import type { Child } from "../types/Child.ts";
import type { Children } from "../types/Children.ts";

/** Resolve element `children` (RFC 0008): a `Children` thunk is called, a plain `Child` passes through. */
export function renderChildren(children: Children | Child | undefined): Child | undefined {
  return typeof children === "function" ? children() : children;
}
