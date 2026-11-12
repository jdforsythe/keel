import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Diag } from "./Diag.ts";
import { noteDiag } from "./noteDiag.ts";
import { routesRun } from "./routesRun.ts";
import { surfaceRun } from "./surfaceRun.ts";
import { viteRun } from "./viteRun.ts";
import { viteTargets } from "./viteTargets.ts";

/**
 * Binary only: the disk half of `keel build` (`Io.build`), after the engine's writes: `routes.json` when every
 * deployable is `node` (`routesRun`), then `surface.json` (`surfaceRun`, k.compat), then one `vite build` per
 * `viteTargets` (k.server Build, k.hosting), stopping at the first that fails. Keel-coded lines become diagnostics;
 * `stderr` is a failed step's text (a Vite build's tail). `code` is the largest step code.
 */
export async function hostBuild(cwd: string): Promise<{ code: number; diagnostics: readonly Diag[]; stderr: string }> {
  const topo = join(cwd, "topology.ts");
  const topology = existsSync(topo) ? readFileSync(topo, "utf8") : undefined;
  const notes: string[] = [];
  let stderr = "";
  const routes = await routesRun(cwd, topology);
  notes.push(...routes.notes);
  let code = routes.code;
  if (routes.code === 0) {
    const surface = await surfaceRun(cwd);
    notes.push(...surface.notes);
    code = Math.max(code, surface.code);
    for (const target of viteTargets(topology)) {
      const b = viteRun(cwd, target);
      notes.push(...(b?.notes ?? []));
      if (b !== undefined && b.code !== 0) {
        stderr += b.tail;
        code = Math.max(code, 1);
        break;
      }
    }
  }
  const diagnostics: Diag[] = [];
  for (const note of notes) {
    const d = noteDiag(note);
    if (d === undefined) stderr += note;
    else diagnostics.push(d);
  }
  return { code, diagnostics, stderr };
}
