import { compile } from "./compile.ts";
import { isSourcePath } from "./internal/isSourcePath.ts";
import type { CompileOptions } from "./types/CompileOptions.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/** A routes manifest the Vite plugin evaluates (`modules/<m>/routes.ts`). */
const MANIFEST = /^modules\/[^/]+\/routes\.ts$/;

/**
 * The content hash of each `.keel/` artifact the compiler writes for a project (k.compiler Artifacts, rfc:0050),
 * keyed by file name. `files` are root-relative project files; the app sources among them are compiled, nothing
 * is evaluated or written. `routes.json` is left out when a routes manifest exists: deriving it evaluates code.
 */
export function artifactHashes(
  files: readonly SourceFile[],
  options: Pick<CompileOptions, "topology"> = {},
): Readonly<Record<string, string>> {
  const sources = files.filter((f) => isSourcePath(f.path));
  const { hashes } = compile(sources, options);
  const evaluated = sources.some((f) => MANIFEST.test(f.path));
  return Object.fromEntries(Object.entries(hashes).filter(([name]) => !evaluated || name !== "routes.json"));
}
