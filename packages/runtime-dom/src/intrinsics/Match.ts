import { anchored } from "../internal/anchored.ts";
import { match } from "../ops/match.ts";
import type { CaseNode } from "../types/CaseNode.ts";

const inferKey = (value: object, tags: ReadonlySet<string>): string => {
  for (const [k, v] of Object.entries(value)) if (typeof v === "string" && tags.has(v)) return k;
  return "tag";
};

/**
 * `<Match on={union}>` with one `Case` per variant (k.component). Compiler intrinsic (the compiler passes
 * the union's discriminant); at runtime the `match` op wrapper, inferring the discriminant from `on`.
 */
export function Match<U extends object>(props: {
  readonly on: U;
  readonly children: readonly CaseNode<U>[];
  readonly key?: string;
}): Node {
  const cases: Record<string, (value: () => U) => Node> = {};
  for (const c of props.children) cases[c.tag] ??= c.render;
  const key = props.key ?? inferKey(props.on, new Set(Object.keys(cases)));
  return anchored((a) => match(a, () => props.on, key, cases));
}
