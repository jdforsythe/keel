import { isCodePath } from "./isCodePath.ts";
import { isTestPath } from "./isTestPath.ts";

/**
 * App code (the scope of "in app code" rules): a code file that is not test code, not under `.keel/` or
 * `node_modules/`, and not a tool config (`*.config.*`). A file under `unsafe/` is app code but for its lifted ranges.
 */
export function isAppPath(path: string): boolean {
  if (!isCodePath(path) || isTestPath(path)) return false;
  if (/(?:^|\/)(?:\.keel|node_modules)\//.test(path)) return false;
  return !/\.config\.[cm]?[jt]sx?$/.test(path);
}
