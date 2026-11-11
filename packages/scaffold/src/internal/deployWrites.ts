import { deployFiles } from "../deployFiles.ts";
import type { Writes } from "./Writes.ts";
import { topologyOf } from "./topologyOf.ts";

const CI = ".github/workflows/ci.yml";
/** A path the deploy generator writes: `deploy/<name>/Dockerfile` or `deploy/compose.yaml`. */
const DEPLOY = /^deploy\/(?:[^/]+\/Dockerfile|compose\.yaml)$/;

/**
 * Writes that bring the generated deploy files of `files` in line with its `topology.ts`: path -> text, or null for
 * a deploy file no deployable needs. The CI workflow is kept when the tree has one; `deploy/` files when `always`,
 * when the tree has `turbo.json` (a project outside the Keel monorepo) or when it already holds a `deploy/` file.
 * Empty without a readable `topology.ts`.
 */
export function deployWrites(files: ReadonlyMap<string, string>, always = false): Writes {
  const out: Writes = new Map();
  const topology = topologyOf(files);
  if (topology === null) return out;
  const ci = files.has(CI);
  const want = deployFiles(topology, { ci });
  const paths = [...files.keys()];
  const keep = always || files.has("turbo.json") || paths.some((p) => p.startsWith("deploy/"));
  for (const [p, v] of want) if (p === CI || keep) out.set(p, v);
  if (keep) for (const p of paths) if (DEPLOY.test(p) && !want.has(p)) out.set(p, null);
  return out;
}
