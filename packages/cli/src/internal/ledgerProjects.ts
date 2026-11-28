import type { SourceFile } from "../types/SourceFile.ts";

const MANIFEST = /^((?:packages|apps|examples)\/[^/]+)\/package\.json$/;

/**
 * The projects of the folder `keel ledger` runs in (k.ledger-items Projects), by name: `.`, then each
 * `packages/<p>`, `apps/<a>` and `examples/<e>` whose `package.json` is among `files`, in path order.
 */
export function ledgerProjects(files: readonly SourceFile[]): string[] {
  const found = files.flatMap((f) => {
    const dir = MANIFEST.exec(f.path)?.[1];
    return dir === undefined ? [] : [dir];
  });
  return [".", ...[...new Set(found)].sort()];
}
