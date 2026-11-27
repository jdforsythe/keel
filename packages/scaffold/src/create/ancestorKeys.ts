import { posix } from "node:path";
import { folderAbove } from "../internal/folderAbove.ts";

/** The files k.create-manager Workspace reads in each folder above the target. */
const NAMES = ["pnpm-workspace.yaml", "package.json", "node_modules/@keel/cli/package.json"];

/**
 * The `ancestors` keys `createPlan` reads for `folder` (k.create-manager Workspace): each Workspace file in each folder above
 * it, keyed from the working folder (absolute for an absolute `folder`); `depth` is how many folders the working folder
 * has above it, so no key climbs past the file system's root. The caller reads the files that exist.
 */
export function ancestorKeys(folder: string, depth: number): string[] {
  return folderAbove(folder, depth).above.flatMap((dir) => NAMES.map((n) => posix.join(dir, n)));
}
