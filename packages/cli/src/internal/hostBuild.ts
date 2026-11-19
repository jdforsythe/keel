import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Diag } from "./Diag.ts";
import { routesRun } from "./routesRun.ts";
import { stepNotes } from "./stepNotes.ts";
import { surfaceRun } from "./surfaceRun.ts";
import { viteRun } from "./viteRun.ts";
import { viteTargets } from "./viteTargets.ts";
import { writeCspFiles } from "./writeCspFiles.ts";

/**
 * Binary only: the disk half of `keel build` (`Io.build`), after the engine's writes: `routes.json` when every
 * deployable is `node` (`routesRun`), then `surface.json` (`surfaceRun`, k.compat), then one `vite build` per
 * `viteTargets` (k.server Build, k.hosting), stopping at the first that fails, then each `client` and `static`
 * deployable's `csp.txt` (`writeCspFiles`, k.security). Keel-coded lines become diagnostics;
 * `stderr` is a failed step's text (a Vite build's tail). `code` is the largest step code. Keel-coded lines become
 * diagnostics (`stepNotes`); those of `routesRun` and the Vite builds are advisory: printed to stderr (W1005, E1006 for a `routes.ts`
 * that throws) and the exit code left alone, as the plugin's warning does.
 */
export async function hostBuild(cwd: string): Promise<{ code: number; diagnostics: readonly Diag[]; stderr: string }> {
  const topo = join(cwd, "topology.ts");
  const topology = existsSync(topo) ? readFileSync(topo, "utf8") : undefined;
  const advisory: string[] = [];
  const failing: string[] = [];
  let stderr = "";
  const routes = await routesRun(cwd, topology);
  advisory.push(...routes.notes);
  let code = routes.code;
  if (routes.code === 0) {
    const surface = await surfaceRun(cwd);
    failing.push(...surface.notes);
    code = Math.max(code, surface.code);
    for (const target of viteTargets(topology)) {
      const b = viteRun(cwd, target);
      advisory.push(...(b?.notes ?? []));
      if (b !== undefined && b.code !== 0) {
        stderr += b.tail;
        code = Math.max(code, 1);
        break;
      }
    }
    if (code === 0) advisory.push(...(await writeCspFiles(cwd, topology, process.env)));
  }
  const diagnostics: Diag[] = [];
  for (const [notes, soft] of [
    [advisory, true],
    [failing, false],
  ] as const) {
    const sorted = stepNotes(notes, soft);
    diagnostics.push(...sorted.diagnostics);
    stderr += sorted.stderr;
  }
  return { code, diagnostics, stderr };
}
