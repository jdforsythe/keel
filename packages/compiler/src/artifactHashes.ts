import { compile } from "./compile.ts";
import { isSourcePath } from "./internal/isSourcePath.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import type { CompileOptions } from "./types/CompileOptions.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/**
 * The content hash of each `.keel/` artifact the compiler writes for a project (k.compiler Artifacts, rfc:0050),
 * keyed by file name. `files` are root-relative project files; the app sources among them are compiled, nothing
 * is evaluated or written. `routes.json` is `null` when the project's build evaluates a routes manifest
 * (`projectManifests`): `keel check` compares it with `routeLiterals` instead (rfc:0055, rfc:0059).
 */
export function artifactHashes(
  files: readonly SourceFile[],
  options: Pick<CompileOptions, "topology"> = {},
): Readonly<Record<string, string | null>> {
  const sources = files.filter((f) => isSourcePath(f.path));
  const { hashes } = compile(sources, options);
  const evaluated = projectManifests(
    options.topology,
    sources.map((f) => f.path),
  );
  return evaluated.length > 0 ? { ...hashes, "routes.json": null } : { ...hashes };
}
