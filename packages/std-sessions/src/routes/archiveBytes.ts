import type { Archive } from "../Archive.schema.ts";
import { utf8Length } from "../internal/utf8Length.ts";

/** The UTF-8 bytes of `archive` as JSON (what `ctx.storage` holds of its state). */
export function archiveBytes(archive: Archive): number {
  return utf8Length(JSON.stringify(archive));
}
