import { turboJson } from "../templates/turboJson.ts";
import type { DeployShells } from "../types/DeployShells.ts";
import type { Writes } from "./Writes.ts";
import { deployWrites } from "./deployWrites.ts";
import { moduleIds } from "./moduleIds.ts";

/**
 * The generated files an operation that adds, removes or places a module rewrites (k.scaffold Turbo emission), from
 * the tree after its own edits: `turbo.json` when the tree has one, the CI workflow and the deploy files (`deployWrites`, with the shell targets `shells`).
 */
export function regenerated(tree: ReadonlyMap<string, string>, shells: DeployShells = {}): Writes {
  const out = deployWrites(tree, false, undefined, shells);
  if (tree.has("turbo.json")) out.set("turbo.json", turboJson(moduleIds(tree)));
  return out;
}
