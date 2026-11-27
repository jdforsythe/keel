import { join } from "node:path";
import type { SourceFile } from "../../types/SourceFile.ts";
import { CODE_FILE } from "../CODE_FILE.ts";
import type { Work } from "./Work.ts";
import { deriveEvaluated } from "./deriveEvaluated.ts";

/** A project of the ledger (k.ledger-items Projects) with a `topology.ts`: the folder itself, or `apps/<a>/` and the like. */
const PROJECT = /^((?:(?:packages|apps|examples)\/[^/]+\/)?)topology\.ts$/;

/**
 * `files` with each ledger project's `.keel/routes.json` (k.a11y Claims, k.derived Readers) set to its derivation: a
 * project is the run's folder or `packages/<p>/`, `apps/<a>/`, `examples/<e>/` holding a `topology.ts`; its
 * `routes.json` is the evaluated view (`deriveEvaluated`, cached).
 * A project whose evaluation fails keeps what `files` holds.
 */
export async function derivedRoutes(cwd: string, files: readonly SourceFile[], work: Work): Promise<SourceFile[]> {
  const dirs = files.flatMap((f) => {
    const m = PROJECT.exec(f.path);
    return m === null ? [] : [m[1] ?? ""];
  });
  const derived = new Map<string, string>();
  for (const dir of dirs) {
    const own = files
      .filter((f) => f.path.startsWith(dir) && !dirs.some((d) => d.length > dir.length && f.path.startsWith(d)))
      .map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const root = join(cwd, dir);
    const codes = own.filter((f) => CODE_FILE.test(f.path)).map((f) => f.path);
    const ev = await deriveEvaluated(root, own, codes, work);
    if (ev.problems.length === 0) derived.set(`${dir}.keel/routes.json`, ev.routes);
  }
  const out = files.map((f) => {
    const text = derived.get(f.path);
    return text === undefined ? f : { path: f.path, source: text };
  });
  for (const [path, source] of derived) if (!files.some((f) => f.path === path)) out.push({ path, source });
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
