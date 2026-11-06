import { type Result, ok } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { fail } from "./fail.ts";
import { introduced } from "./introduced.ts";
import { isGenerated } from "./isGenerated.ts";
import { sortedKeys } from "./sortedKeys.ts";

/**
 * Turn pending writes into an edit set: refuse writes into generated locations other than `allowGenerated`
 * (E1005), refuse an edit set that introduces a check diagnostic (E1353), else return the new tree and the
 * sorted created/changed/removed paths. `before` is never mutated.
 */
export function commit(
  before: ReadonlyMap<string, string>,
  writes: Writes,
  allowGenerated: readonly string[] = [],
): Result<Edit, ScaffoldError> {
  for (const p of sortedKeys(writes.keys()))
    if (isGenerated(p) && !allowGenerated.includes(p))
      return fail("E1005", p, `${p} is generated and read-only; the operation would write it`);
  const created: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  const next = new Map(before);
  for (const p of sortedKeys(writes.keys())) {
    const v = writes.get(p);
    const old = before.get(p);
    if (v === null || v === undefined) {
      if (old !== undefined) {
        next.delete(p);
        removed.push(p);
      }
    } else if (old === undefined) {
      next.set(p, v);
      created.push(p);
    } else if (old !== v) {
      next.set(p, v);
      changed.push(p);
    }
  }
  const files = new Map<string, string>();
  for (const p of sortedKeys(next.keys())) files.set(p, next.get(p) ?? "");
  const d = introduced(before, files);
  if (d !== null)
    return fail("E1353", d.path, `operation aborted, would introduce ${d.code}: ${d.message}; nothing written`, d);
  return ok({ files, created, changed, removed });
}
