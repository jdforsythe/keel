import { shortPath } from "@keel/compiler/internal";

/**
 * E1765's message at check (k.realm One copy): `two copies of <name> in one realm: <first> and <second>`, in at most
 * 89 UTF-16 code units; past that the first folder is shortened from its front first, then the second.
 */
export function twoCopiesMessage(name: string, first: string, second: string): string {
  const room = 89 - `two copies of ${name} in one realm:  and `.length;
  const a = shortPath(first, Math.max(0, room - second.length));
  const b = shortPath(second, Math.max(0, room - a.length));
  return `two copies of ${name} in one realm: ${a} and ${b}`;
}
