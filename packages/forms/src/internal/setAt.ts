import type { Node } from "./Node.ts";
import { isRecord } from "./isRecord.ts";
import { nodeAt } from "./nodeAt.ts";
import { unwrap } from "./unwrap.ts";

/**
 * Copy-on-write set of the value at a path; `undefined` removes the key (absent, as k.schema reads it).
 * Missing containers are created as arrays or objects according to the schema node at each step.
 */
export function setAt(root: Node, value: unknown, segments: readonly string[], next: unknown): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return next;
  const here = nodeAt(root, []);
  const child = nodeAt(root, [head]);
  const inner =
    child === undefined ? undefined : setAt(child, value === undefined ? undefined : read(value, head), rest, next);
  const isArray = here !== undefined && unwrap(here).kind === "array";
  if (isArray) {
    const copy = Array.isArray(value) ? [...value] : [];
    const i = Number(head);
    if (inner === undefined) {
      if (i === copy.length - 1) copy.pop();
      else copy[i] = undefined;
    } else copy[i] = inner;
    return copy;
  }
  const copy: Record<string, unknown> = isRecord(value) ? { ...value } : {};
  if (inner === undefined) delete copy[head];
  else copy[head] = inner;
  return copy;
}

function read(value: unknown, seg: string): unknown {
  if (Array.isArray(value)) return value[Number(seg)];
  return isRecord(value) && Object.hasOwn(value, seg) ? value[seg] : undefined;
}
