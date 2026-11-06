import { anchored } from "../internal/anchored.ts";
import { descriptorOf } from "../internal/descriptorOf.ts";
import { match } from "../ops/match.ts";
import type { CaseNode } from "../types/CaseNode.ts";

/**
 * `<Match on={union}>` with one `Case` per variant (k.component). Compiler intrinsic: the compiler lowers it
 * to `match(anchor, on, key, cases)` with a statically chosen `key`. This runtime form (for uncompiled code)
 * takes the discriminant as `key` (default `state` when every case is loading|error|ready, else `tag`) and
 * never reads `on` to infer it (D25).
 */
export function Match<U extends object>(props: {
  readonly on: U;
  readonly children: CaseNode<U> | readonly CaseNode<U>[];
  readonly key?: string;
}): Node {
  const cases: Record<string, (value: () => U) => Node> = {};
  const list = Array.isArray(props.children) ? props.children : [props.children];
  for (const c of list) {
    const info = c instanceof Node ? descriptorOf(c) : undefined;
    if (info !== undefined) cases[info.tag] ??= info.render;
  }
  const key = props.key ?? (Object.keys(cases).every((t) => STATES.has(t)) ? "state" : "tag");
  return anchored((a) => match(a, () => props.on, key, cases));
}

const STATES: ReadonlySet<string> = new Set(["loading", "error", "ready"]);
