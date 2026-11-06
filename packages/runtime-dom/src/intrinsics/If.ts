import { anchored } from "../internal/anchored.ts";
import { cond } from "../ops/cond.ts";

/** `<If when={x} fallback={...}>` (k.component). Compiler intrinsic; at runtime the `cond` op wrapper. */
export function If(props: {
  readonly when: unknown;
  readonly children: () => Node;
  readonly fallback?: () => Node;
}): Node {
  return anchored((a) => cond(a, () => props.when, props.children, props.fallback));
}
