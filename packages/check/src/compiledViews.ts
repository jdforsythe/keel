import { artifactTexts, parseTopology, projectDirs } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import { canonicalJson, hashOf } from "@keel/compiler/internal";
import { choiceThemes } from "./internal/choiceThemes.ts";
import { libraryFolders } from "./internal/libraryFolders.ts";
import { schemesIn } from "./internal/schemesIn.ts";
import type { CheckOptions } from "./types/CheckOptions.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/**
 * The compiled views of the project at `dir` (k.derived Derivations): the bytes of each `.keel/` file the compiler
 * derives from the sources under `dir` in `project` (paths made relative to it; a file a deeper project holds is that
 * project's), with its own `topology.ts` (the root's: `options.topology` when given), keyed by name; `routes.json`, an evaluated view (k.derived Derivations), is not among them. `schemes.json` (k.schemes) comes from the
 * project's evaluated tokens in `options` (`artifacts.tokens`, else `projectArtifacts[dir].tokens`); with no
 * `tokens.ts`, one scheme and no themes; with a `tokens.ts` whose tokens are not given, it is absent. `keel check` and `check()`
 * compare with these, and the `keel` commands write them. A library's files among `project` are read at
 * `modules/<id>/<f>`, as the app's (k.library In an app).
 */
export function compiledViews(
  dir: string,
  project: readonly SourceFile[],
  options: Pick<CheckOptions, "artifacts" | "projectArtifacts" | "topology"> = {},
): Readonly<Record<string, string | null>> {
  const libs = libraryFolders(project);
  const viewed = project.map((f) => {
    const at = libs.view(f.path);
    return at === f.path ? f : { path: at, source: f.source };
  });
  const dirs = projectDirs(viewed);
  const deeper = (path: string): boolean =>
    dirs.some((d) => d.length > dir.length && d.startsWith(dir) && path.startsWith(d));
  const sources = viewed
    .filter((f) => f.path.startsWith(dir) && !deeper(f.path))
    .map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
  const manifest = project.find((f) => f.path === `${dir}topology.ts`)?.source;
  const topology: Topology | undefined =
    dir === "" ? options.topology : manifest === undefined ? undefined : parseTopology(manifest).topology;
  const compiled = artifactTexts(sources, topology === undefined ? {} : { topology });
  // `routes.json` is an evaluated view: its bytes are the evaluation's, never the compile's.
  const texts = Object.fromEntries(Object.entries(compiled).filter(([name]) => name !== "routes.json"));
  const tokens: unknown = options.artifacts?.tokens ?? options.projectArtifacts?.[dir]?.tokens;
  const hasTokens = project.some((f) => f.path === `${dir}tokens.ts`);
  const schemes = tokens !== undefined ? schemesIn(tokens) : hasTokens ? undefined : ["light"];
  if (schemes === undefined) return texts;
  const data = { schemes: [...schemes], themes: choiceThemes(tokens) };
  return { ...texts, "schemes.json": `${canonicalJson({ data, hash: hashOf(data) })}\n` };
}
