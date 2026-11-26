import path from "node:path";

import type { HeldLibrary } from "./HeldLibrary.ts";

/** The library among `libraries` whose real folder holds `file`, or undefined. */
export function libraryOf(libraries: readonly HeldLibrary[], file: string): HeldLibrary | undefined {
  return libraries.find((l) => {
    const rel = path.relative(l.dir, file);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  });
}
