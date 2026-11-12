import { posix } from "node:path";
import type { Io } from "../types/Io.ts";

/**
 * Whether the project at `io.cwd` is an app inside a workspace (as the Keel monorepo's apps are): a directory above it
 * holds `pnpm-workspace.yaml`, read through `io.read`. Its CI workflow lives at the workspace root. Without `io.read`,
 * no.
 */
export function inWorkspace(io: Io): boolean {
  const read = io.read;
  if (read === undefined) return false;
  for (let d = posix.dirname(io.cwd); ; d = posix.dirname(d)) {
    if (read(posix.join(d, "pnpm-workspace.yaml")) !== undefined) return true;
    if (posix.dirname(d) === d) return false;
  }
}
