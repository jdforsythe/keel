import type { Checked } from "./Checked.ts";
import type { ModuleContract } from "./ModuleContract.ts";
import { contractCalls } from "./contractCalls.ts";
import { isAppPath } from "./isAppPath.ts";

const CONTRACT = /^((?:.*\/)?)modules\/([^/]+)\/([^/]+)\.contract\.ts$/;

/**
 * The contract of each app module among `files` (k.contract): the first `contract(...)` call of each
 * `modules/<id>/<id>.contract.ts`, in file order. A contract file of another stem holds no module's contract.
 */
export function moduleContracts(files: readonly Checked[]): ModuleContract[] {
  const out: ModuleContract[] = [];
  for (const { file, parsed } of files) {
    const m = CONTRACT.exec(file.path);
    if (m === null || m[2] !== m[3] || !isAppPath(file.path)) continue;
    const [first] = contractCalls(file, parsed.program);
    if (first !== undefined) out.push({ dir: m[1] ?? "", module: m[2] ?? "", contract: first });
  }
  return out;
}
