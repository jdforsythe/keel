import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";

/** The `keel` binary the project at `dir` resolves (its own `@keel/cli`): `bin.ts` beside the package's entry. */
export function keelBin(dir: string): string {
  const entry = createRequire(join(dir, "package.json")).resolve("@keel/cli");
  return join(dirname(entry), `bin${extname(entry)}`);
}
