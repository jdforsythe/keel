import type { Origins } from "@keel/compiler";
import { deployWrites } from "./internal/deployWrites.ts";
import { sortedKeys } from "./internal/sortedKeys.ts";
import type { DeployDrift } from "./types/DeployDrift.ts";
import type { DeployShells } from "./types/DeployShells.ts";

/**
 * The generated deploy files of a project tree (path -> text) that differ from `deployFiles` of its `topology.ts`,
 * sorted by path: changed, missing, or no longer needed. `keel check` reports each as E1005 and `keel build`
 * (`always`) writes them; without `always`, a tree without `turbo.json` and without `deploy/` files (an app inside
 * the Keel monorepo) is checked for its CI workflow only. `policy` gives the content security policy of a `client`
 * document for a deployable's declared origins (`cspPolicy({ peers: [], origins })` of `@keel/server/csp`; k.origins),
 * which each shell target is given; `shells` are the
 * registered shell targets (k.shell Shell target), whose files and CI jobs are generated.
 */
export function deployDrift(
  files: ReadonlyMap<string, string>,
  always = false,
  policy?: (origins?: Origins) => string,
  shells: DeployShells = {},
): DeployDrift[] {
  const writes = deployWrites(files, always, policy, shells);
  const out: DeployDrift[] = [];
  for (const path of sortedKeys(writes.keys())) {
    const want = writes.get(path) ?? null;
    const have = files.get(path) ?? null;
    if (want !== have) out.push({ path, want, have });
  }
  return out;
}
