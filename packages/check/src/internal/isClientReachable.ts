import { SERVER_ONLY_NAME, clientReach } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { parseFile } from "./parseFile.ts";
import { topologyFor } from "./topologyFor.ts";

const reaches = new WeakMap<readonly SourceFile[], Map<string, ReadonlySet<string>>>();

/**
 * Whether `path` is client-reachable (k.boundary Reach, E1004's reachability): read from `clientReach` over the files of
 * its project's `topology.ts` directory, once per project; with no `topology.ts`, any file not named `*.server.*` or
 * `*.guard.*`.
 */
export function isClientReachable(path: string, project: readonly SourceFile[]): boolean {
  const read = topologyFor(path, project);
  if (read === undefined) return !SERVER_ONLY_NAME.test(path);
  const byDir = reaches.get(project) ?? new Map<string, ReadonlySet<string>>();
  reaches.set(project, byDir);
  let subject = byDir.get(read.dir);
  if (subject === undefined) {
    const files = project
      .filter((f) => f.path.startsWith(read.dir))
      .flatMap((f) => {
        const p = parseFile(f);
        return p.ok ? [{ path: f.path.slice(read.dir.length), program: p.program }] : [];
      });
    subject = clientReach(files, read.topology).subject;
    byDir.set(read.dir, subject);
  }
  return subject.has(path.slice(read.dir.length));
}
