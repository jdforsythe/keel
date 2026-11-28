import { shortPath } from "@keel/compiler/internal";

const TAIL = " declares import.meta types; they are Keel's and Node's only";
const LIMIT = 89;

/**
 * E1016's declaration message (k.boundary Ambient types): `<file> declares import.meta types; they are Keel's and
 * Node's only`, at most 89 UTF-16 code units. `<file>` is cut from its front: whole folders first (`.../`), then
 * units, never half a surrogate pair.
 */
export function ambientMessage(file: string): string {
  const room = LIMIT - TAIL.length;
  let shown = shortPath(file, room);
  if (shown.length > room) {
    let from = file.length - (room - 3);
    const unit = file.charCodeAt(from);
    if (unit >= 0xdc00 && unit <= 0xdfff) from++;
    shown = `...${file.slice(from)}`;
  }
  return `${shown}${TAIL}`;
}
