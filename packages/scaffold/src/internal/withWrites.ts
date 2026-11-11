import type { Writes } from "./Writes.ts";

/** The tree after `writes` (null removes a path); `files` is not mutated. */
export function withWrites(files: ReadonlyMap<string, string>, writes: Writes): Map<string, string> {
  const out = new Map(files);
  for (const [p, v] of writes) {
    if (v === null) out.delete(p);
    else out.set(p, v);
  }
  return out;
}
