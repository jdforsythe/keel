import type { Writes } from "./Writes.ts";
import { isGenerated } from "./isGenerated.ts";
import { isGeneratedSource } from "./isGeneratedSource.ts";
import { sortedKeys } from "./sortedKeys.ts";

/**
 * The first write that edits a generated file, or null: a write into a generated location (`.keel/`, turbo, CI) or a
 * change to a file whose first line is a generated marker (`scaffold service` schemas). Removing a marked file is
 * allowed only when the edit set recreates its exact bytes elsewhere (a module rename or move). `allow` lists the
 * generated paths the operation itself regenerates.
 */
export function readOnlyEdit(
  before: ReadonlyMap<string, string>,
  writes: Writes,
  allow: readonly string[],
): string | null {
  const created = new Set<string>();
  for (const [p, v] of writes) if (typeof v === "string" && !before.has(p)) created.add(v);
  for (const p of sortedKeys(writes.keys())) {
    if (allow.includes(p)) continue;
    if (isGenerated(p)) return p;
    const old = before.get(p);
    const v = writes.get(p);
    if (old === undefined || old === v || !isGeneratedSource(old)) continue;
    if (v === null && created.has(old)) continue;
    return p;
  }
  return null;
}
