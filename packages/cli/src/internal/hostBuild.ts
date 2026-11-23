import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Diag } from "./Diag.ts";
import { routesRun } from "./routesRun.ts";
import { stepNotes } from "./stepNotes.ts";
import { surfaceRun } from "./surfaceRun.ts";
import { viteRun } from "./viteRun.ts";
import { viteTargets } from "./viteTargets.ts";
import { writeCspFiles } from "./writeCspFiles.ts";

/** A Keel-coded error line. */
const ERROR = /^E\d{4} /;

/**
 * Binary only: the disk half of `keel build` (`Io.build`), after the engine's writes: `routes.json` when every
 * deployable is `node` (`routesRun`), then `surface.json` (`surfaceRun`, k.compat), then one `vite build` per
 * `viteTargets` (k.server Build, k.hosting), stopping at the first that fails, then each `client` and `static`
 * deployable's `csp.txt` (`writeCspFiles`, k.security). Keel-coded lines become diagnostics (`stepNotes`);
 * `stderr` is a failed step's text (a Vite build's message lines, `viteRun`). `code` is the largest step code; only a
 * rejected routes evaluation (E1000, E1049) stops the steps after it. An
 * error line of `routesRun` or a Vite build (an evaluation problem: E1006, E1807) is an error diagnostic, as each fails
 * its step (k.compiler Build-time evaluation); a warning line (W1005) is advisory, printed to stderr. A throwing
 * contract file is the surface step's E1006, so the routes step's line for that file is dropped.
 * `refresh` (k.scaffold Refresh) stops before the Vite builds: `routes.json` is evaluated whatever the deployables
 * are, since no Vite build follows to write it, then `surface.json`; no bundle, no `csp.txt`, nothing under `dist/`,
 * and no W1005 for the `routes.json` it rewrites.
 */
export async function hostBuild(
  cwd: string,
  refresh = false,
): Promise<{ code: number; diagnostics: readonly Diag[]; stderr: string }> {
  const topo = join(cwd, "topology.ts");
  const topology = existsSync(topo) ? readFileSync(topo, "utf8") : undefined;
  const advisory: string[] = [];
  const failing: string[] = [];
  let stderr = "";
  /** A step's lines: errors fail the build, the rest are advisory. */
  const sort = (notes: readonly string[]): void => {
    for (const n of notes) (ERROR.test(n) ? failing : advisory).push(n);
  };
  const ran = await routesRun(cwd, topology, refresh);
  const routes = refresh ? { ...ran, notes: ran.notes.filter((n) => !n.startsWith("W1005 ")) } : ran;
  let code = routes.code;
  if (routes.rejected === true) sort(routes.notes);
  else {
    const surface = await surfaceRun(cwd);
    failing.push(...surface.notes);
    const reported = surface.notes.flatMap((n) => /^E1006 (\S+) /.exec(n)?.[1] ?? []);
    sort(routes.notes.filter((n) => !reported.some((f) => n.startsWith(`E1006 ${f} `))));
    code = Math.max(code, surface.code);
    for (const target of refresh ? [] : viteTargets(topology)) {
      const b = viteRun(cwd, target);
      sort((b?.notes ?? []).filter((n) => !reported.some((f) => n.startsWith(`E1006 ${f} `))));
      if (b !== undefined && b.code !== 0) {
        stderr += b.tail;
        code = Math.max(code, 1);
        break;
      }
    }
    if (code === 0 && !refresh) advisory.push(...(await writeCspFiles(cwd, topology, process.env)));
  }
  const diagnostics: Diag[] = [];
  // A node deployable's Vite build evaluates the routes again: its lines repeat the routes step's.
  for (const [notes, soft] of [
    [[...new Set(advisory)], true],
    [[...new Set(failing)], false],
  ] as const) {
    const sorted = stepNotes(notes, soft);
    diagnostics.push(...sorted.diagnostics);
    stderr += sorted.stderr;
  }
  return { code, diagnostics, stderr };
}
