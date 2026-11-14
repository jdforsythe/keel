import { deployDrift } from "@keel/scaffold";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const TOPOLOGY = /^(.*?)topology\.ts$/;

const message = (have: string | null, want: string | null): string =>
  have === null
    ? "generated deploy file missing; keel build writes it from topology.ts"
    : want === null
      ? "generated deploy file no deployable needs; keel build removes it"
      : "generated deploy file differs from topology.ts; keel build rewrites it";

/**
 * E1005 for each generated deploy file (Dockerfiles, compose, shell files, the CI workflow) of each project in `project` that
 * differs from what `deployFiles` derives from its `topology.ts` (k.deploy Deploy files), with the regenerated
 * file as the fix. `policy` (`shellPolicy`) is what a Tauri shell's `tauri.conf.json` holds.
 */
export function deployFreshness(project: readonly SourceFile[], policy?: string): Diag[] {
  const dirs: string[] = [];
  for (const f of project) {
    const dir = TOPOLOGY.exec(f.path)?.[1];
    if (dir !== undefined && (dir === "" || dir.endsWith("/")) && !/(?:^|\/)(?:modules|node_modules)\//.test(dir))
      dirs.push(dir);
  }
  const out: Diag[] = [];
  for (const dir of dirs) {
    const tree = new Map(
      project.filter((f) => f.path.startsWith(dir)).map((f) => [f.path.slice(dir.length), f.source]),
    );
    for (const d of deployDrift(tree, false, policy)) {
      const path = `${dir}${d.path}`;
      const fix = unifiedDiff(path, d.have, d.want);
      out.push(makeDiag("E1005", message(d.have, d.want), { path, line: 1, col: 1, fix, see: "k.deploy" }));
    }
  }
  return out;
}
