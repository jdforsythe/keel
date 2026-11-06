import type { CaseNode } from "../types/CaseNode.ts";
import type { CaseDescriptor } from "./CaseDescriptor.ts";
import { descriptors } from "./descriptors.ts";

/** A comment node standing for one `Case`; the descriptor lives in a WeakMap, so the node needs no cast. */
export function caseNode<U>(info: CaseDescriptor): CaseNode<U> {
  const node = document.createComment(`case ${info.tag}`);
  descriptors.set(node, info);
  return node;
}
