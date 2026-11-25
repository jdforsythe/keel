import { SERVER_ONLY_NAME, clientReach } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { dirPrograms } from "./dirPrograms.ts";
import { libraryEntriesUnder } from "./libraryEntriesUnder.ts";
import { topologyFor } from "./topologyFor.ts";

const reaches = new WeakMap<readonly SourceFile[], Map<string, ReadonlySet<string>>>();

/**
 * Whether `path` is client-reachable (k.boundary Reach, E1004's reachability): read from `clientReach` over the files of
 * its project's `topology.ts` directory, once per project; with no `topology.ts`, any file not named `*.server.*` or
 * `*.guard.*`. An import of a library (`projectLibraries`) leads into its files.
 */
export function isClientReachable(path: string, project: readonly SourceFile[]): boolean {
  const read = topologyFor(path, project);
  if (read === undefined) return !SERVER_ONLY_NAME.test(path);
  const byDir = reaches.get(project) ?? new Map<string, ReadonlySet<string>>();
  reaches.set(project, byDir);
  let subject = byDir.get(read.dir);
  if (subject === undefined) {
    subject = clientReach(
      dirPrograms(read.dir, project),
      read.topology,
      libraryEntriesUnder(read.dir, project),
    ).subject;
    byDir.set(read.dir, subject);
  }
  return subject.has(path.slice(read.dir.length));
}
