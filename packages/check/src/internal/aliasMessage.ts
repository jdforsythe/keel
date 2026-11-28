import { shortPath } from "@keel/compiler/internal";

/**
 * E1013's message (k.bundle Aliases): `'<specifier>' reaches <file> by an alias`, in at most 89 UTF-16 code units; past
 * that the specifier is shortened from its front first, then the file.
 */
export function aliasMessage(specifier: string, file: string): string {
  const room = 89 - "'' reaches  by an alias".length;
  const spec = shortPath(specifier, Math.max(0, room - file.length));
  const shown = shortPath(file, Math.max(0, room - spec.length));
  return `'${spec}' reaches ${shown} by an alias`;
}
