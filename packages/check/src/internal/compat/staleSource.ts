import type { SourceFile } from "../../types/SourceFile.ts";
import { hashOf } from "../hashOf.ts";
import type { Surface } from "./Surface.ts";

/**
 * The first file `surface` was evaluated from that is now missing from `project` or changed (paths under `dir`); each
 * is recorded as the artifact hash of its text (`hashOf`, the cli writer's encoding; keep in step).
 */
export function staleSource(surface: Surface, dir: string, project: readonly SourceFile[]): string | undefined {
  for (const [path, hash] of surface.sources) {
    const file = project.find((f) => f.path === `${dir}${path}`);
    if (file === undefined || hashOf(file.source) !== hash) return path;
  }
  return undefined;
}
