import type { CaseDescriptor } from "./CaseDescriptor.ts";
import { descriptors } from "./descriptors.ts";

/** The descriptor of a node made by `caseNode`, if it is one. */
export function descriptorOf(node: Node): CaseDescriptor | undefined {
  return descriptors.get(node);
}
