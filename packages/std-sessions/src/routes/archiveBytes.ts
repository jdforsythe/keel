import type { Archive } from "../Archive.schema.ts";
import { entryBytes } from "./entryBytes.ts";
import { itemBytes } from "./itemBytes.ts";

/**
 * An upper bound of the UTF-8 bytes of `archive` as JSON (what `ctx.storage` holds of its state), from each kept
 * session's tracked `bytes`: linear in the number of sessions, never re-encoding one.
 */
export function archiveBytes(archive: Archive): number {
  let n = 2;
  for (const [fp, e] of Object.entries(archive)) {
    n += entryBytes(fp);
    for (const x of e.sessions) n += itemBytes(x);
  }
  return n;
}
