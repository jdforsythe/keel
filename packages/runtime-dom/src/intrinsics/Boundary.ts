import { anchored } from "../internal/anchored.ts";
import { boundary } from "../ops/boundary.ts";
import type { UnexpectedError } from "../types/UnexpectedError.ts";

/** `<Boundary fallback={(e, reset) => ...}>` (k.errors). Compiler intrinsic; at runtime the `boundary` op wrapper. */
export function Boundary(props: {
  readonly fallback: (error: UnexpectedError, reset: () => void) => Node;
  readonly children: () => Node;
}): Node {
  return anchored((a) => boundary(a, props.children, props.fallback));
}
