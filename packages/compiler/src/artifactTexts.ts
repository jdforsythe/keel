import { compile } from "./compile.ts";
import { artifactText } from "./internal/artifactText.ts";
import { isSourcePath } from "./internal/isSourcePath.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { stdArtifact } from "./stdArtifact.ts";
import type { CompileOptions } from "./types/CompileOptions.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/**
 * The bytes of each compiled `.keel/` view of a project (k.derived Derivations, k.compiler Artifacts), keyed by file
 * name, as the Vite plugin writes them (`artifactText`). `files` are root-relative project files; the app sources
 * among them are compiled, nothing is evaluated or written. `routes.json` is `null` when the project's build
 * evaluates a routes manifest (`projectManifests`): its bytes are then the evaluated derivation's. `std.json` is
 * `stdArtifact`'s data.
 */
export function artifactTexts(
  files: readonly SourceFile[],
  options: Pick<CompileOptions, "topology"> = {},
): Readonly<Record<string, string | null>> {
  const sources = files.filter((f) => isSourcePath(f.path));
  const { artifacts } = compile(sources, options);
  const evaluated = projectManifests(
    options.topology,
    sources.map((f) => f.path),
  );
  return {
    "a11y.json": artifactText(artifacts["a11y.json"]),
    "deps.json": artifactText(artifacts["deps.json"]),
    "ids.json": artifactText(artifacts["ids.json"]),
    "routes.json": evaluated.length > 0 ? null : artifactText(artifacts["routes.json"]),
    "std.json": artifactText(stdArtifact(sources).data),
    "styles.json": artifactText(artifacts["styles.json"]),
  };
}
