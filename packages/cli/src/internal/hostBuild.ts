import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Diag } from "./Diag.ts";
import { stepNotes } from "./stepNotes.ts";
import { viteRun } from "./viteRun.ts";
import { viteTargets } from "./viteTargets.ts";
import { writeCspFiles } from "./writeCspFiles.ts";

/** A Keel-coded error line. */
const ERROR = /^E\d{4} /;

/**
 * Binary only: the disk half of `keel build` (`Io.build`), after the engine's writes (the check before it has kept the
 * derived views, `routes.json` and `surface.json` among them: k.derived Refresh): one `vite build` per `viteTargets`
 * (k.server Build, k.hosting), stopping at the first that fails, then each `client` and `static` deployable's
 * `csp.txt` (`writeCspFiles`, k.security). Keel-coded lines become diagnostics (`stepNotes`); `stderr` is a failed
 * step's text (a Vite build's message lines, `viteRun`). An error line of a Vite build (an evaluation problem: E1006,
 * E1807) is an error diagnostic, as it fails its step (k.compiler Build-time evaluation). `refresh` (k.scaffold
 * Refresh) runs no step: no bundle, no `csp.txt`, nothing under `dist/`. `frozen` gives each Vite build `KEEL_FROZEN=1`.
 */
export async function hostBuild(
  cwd: string,
  refresh = false,
  frozen = false,
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
  let code = 0;
  for (const target of refresh ? [] : viteTargets(topology)) {
    const b = viteRun(cwd, target, frozen);
    sort(b?.notes ?? []);
    if (b !== undefined && b.code !== 0) {
      stderr += b.tail;
      code = 1;
      break;
    }
  }
  if (code === 0 && !refresh) advisory.push(...(await writeCspFiles(cwd, topology, process.env)));
  const diagnostics: Diag[] = [];
  // A node deployable's Vite build evaluates the routes again: its lines repeat.
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
