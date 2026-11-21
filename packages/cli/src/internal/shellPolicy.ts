import type { Origins } from "@keel/compiler";
import type { SourceFile } from "../types/SourceFile.ts";
import { keelModule } from "./keelModule.ts";

/**
 * The content security policy a Tauri shell's generated `tauri.conf.json` holds (k.shell Files), for its deployable's
 * declared origins (k.origins): a `client` document's, `cspPolicy({ peers: [], origins })` of `@keel/server/csp` as
 * the project resolves it. Peer origins stay out: the shell's net driver reaches every origin through the native
 * client, which the policy does not govern, so the file does not change with the environment. Undefined when no `topology.ts` of `project` names `tauri` and no
 * `tauri.conf.json` is there to remove, or when the entry does not load.
 */
export async function shellPolicy(
  cwd: string,
  project: readonly SourceFile[],
): Promise<((origins?: Origins) => string) | undefined> {
  const tauri = project.some(
    (f) =>
      (/(?:^|\/)topology\.ts$/.test(f.path) && f.source.includes("tauri")) ||
      /(?:^|\/)deploy\/[^/]+\/tauri\/tauri\.conf\.json$/.test(f.path),
  );
  if (!tauri) return undefined;
  const policy = (await keelModule(cwd, "@keel/server/csp"))?.cspPolicy;
  if (typeof policy !== "function") return undefined;
  return (origins) => String(policy({ peers: [], origins }));
}
