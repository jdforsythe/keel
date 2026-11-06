import type { Claim } from "./Claim.ts";
import type { Owner } from "./Owner.ts";
import { cx } from "./cx.ts";

/** Run `fn` as a fresh render unit under `owner`, restoring the previous context afterwards. */
export function withCx<T>(owner: Owner, claim: Claim | null, fn: () => T): T {
  const prev = { owner: cx.owner, nodes: cx.nodes, claim: cx.claim };
  cx.owner = owner;
  cx.nodes = [];
  cx.claim = claim;
  try {
    return fn();
  } finally {
    cx.owner = prev.owner;
    cx.nodes = prev.nodes;
    cx.claim = prev.claim;
  }
}
