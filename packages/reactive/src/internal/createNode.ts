import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { rt } from "./rt.ts";

/** Create a node owned by the current owner; E1203 when there is none (a scope may be a root). */
export function createNode(kind: Node["kind"], fn: (() => boolean) | undefined, writes: readonly unknown[]): Node {
  const owner = rt.owner;
  if (owner === null && kind !== "scope")
    throw fail("E1203", "reactive primitive created outside any scope; wrap it in scope(fn)");
  const n: Node = {
    id: ++rt.lastId,
    kind,
    fn,
    sources: [],
    observers: [],
    state: fn ? State.Dirty : State.Clean,
    owner,
    owned: [],
    writes,
    gone: false,
  };
  owner?.owned.push(n);
  rt.nodes.add(n);
  return n;
}
