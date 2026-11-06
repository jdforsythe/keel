import type { A11yNode } from "../types/A11yNode.ts";
import { nameOf } from "./nameOf.ts";
import { roleOf } from "./roleOf.ts";
import { stateOf } from "./stateOf.ts";
import { treeOf } from "./treeOf.ts";

/** The a11y node of an element with an id; its children are the id-bearing elements below it. */
export function nodeOf(el: Element): A11yNode {
  const role = roleOf(el);
  return { id: el.id, role, name: nameOf(el, role), state: stateOf(el, role), children: treeOf(el) };
}
