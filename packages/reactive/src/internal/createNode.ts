import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { rt } from "./rt.ts";

/** Create a node owned by the current scope; E1203 when there is none. */
export function createNode(fn: (() => boolean) | undefined, effect: boolean, writes: readonly unknown[]): Node {
  const owner = rt.owner;
  if (owner === null) throw fail("E1203", "reactive primitive created outside any scope; wrap it in scope(fn)");
  const n: Node = {
    fn,
    sources: [],
    observers: [],
    state: fn ? State.Dirty : State.Clean,
    effect,
    owner,
    owned: [],
    writes,
    gone: false,
  };
  if (fn) owner.owned.push(n);
  return n;
}
