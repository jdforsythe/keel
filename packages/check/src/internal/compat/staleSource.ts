import { sourceHash } from "@keel/compiler/internal";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Surface } from "./Surface.ts";

/**
 * The first file `surface` was evaluated from that is now missing from `project` or changed (paths under `dir`); each
 * is recorded as the hash of its normal form (`sourceHash`, k.compat Sources), which a file that does not parse lacks, so it
 * counts as changed.
 */
export function staleSource(surface: Surface, dir: string, project: readonly SourceFile[]): string | undefined {
  for (const [path, hash] of surface.sources) {
    const file = project.find((f) => f.path === `${dir}${path}`);
    if (file === undefined || sourceHash(path, file.source) !== hash) return path;
  }
  return undefined;
}
