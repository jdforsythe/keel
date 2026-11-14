import { deployWrites } from "./internal/deployWrites.ts";
import { sortedKeys } from "./internal/sortedKeys.ts";
import type { DeployDrift } from "./types/DeployDrift.ts";

/**
 * The generated deploy files of a project tree (path -> text) that differ from `deployFiles` of its `topology.ts`,
 * sorted by path: changed, missing, or no longer needed. `keel check` reports each as E1005 and `keel build`
 * (`always`) writes them; without `always`, a tree without `turbo.json` and without `deploy/` files (an app inside
 * the Keel monorepo) is checked for its CI workflow only. `policy`, the content security policy of a `client`
 * document (`cspPolicy({ peers: [] })` of `@keel/server/csp`), is what a Tauri shell's `tauri.conf.json` holds;
 * without it that file is neither checked nor written.
 */
export function deployDrift(files: ReadonlyMap<string, string>, always = false, policy?: string): DeployDrift[] {
  const writes = deployWrites(files, always, policy);
  const out: DeployDrift[] = [];
  for (const path of sortedKeys(writes.keys())) {
    const want = writes.get(path) ?? null;
    const have = files.get(path) ?? null;
    if (want !== have) out.push({ path, want, have });
  }
  return out;
}
