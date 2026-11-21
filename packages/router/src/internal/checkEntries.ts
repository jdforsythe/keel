import type { EntryShape } from "./EntryShape.ts";
import { codedError } from "./codedError.ts";
import { patternClash } from "./patternClash.ts";
import { prefixCollision } from "./prefixCollision.ts";
import { readEntry } from "./readEntry.ts";

/**
 * Read and check every entry of module `module`'s contract (`readEntry`), each key first: E1155 a key not
 * `<module>.<name>`; then the entries together: E1502 two entries at one path pattern other than API entries at
 * distinct methods, E1509 a k.prefix collision.
 */
export function checkEntries(module: string, entries: object): ReadonlyMap<string, EntryShape> {
  const out = new Map<string, EntryShape>();
  for (const [id, e] of Object.entries(entries)) {
    if (!id.startsWith(`${module}.`))
      throw codedError("E1155", `${id}: a route id of module ${module} is ${module}.<name>`);
    out.set(id, readEntry(module, id, e));
  }
  const clash = patternClash(out.values());
  if (clash !== null) throw codedError("E1502", clash);
  const collision = prefixCollision(out.values());
  if (collision !== null) throw codedError("E1509", collision);
  return out;
}
