import { isRecord } from "./isRecord.ts";

/** Read the value at a path of segments; undefined when any step is missing. */
export function getAt(root: unknown, segments: readonly string[]): unknown {
  let x = root;
  for (const seg of segments) {
    if (Array.isArray(x)) x = x[Number(seg)];
    else if (isRecord(x) && Object.hasOwn(x, seg)) x = x[seg];
    else return undefined;
  }
  return x;
}
