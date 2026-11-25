import type { Issue } from "./Issue.ts";
import { plainWalk } from "./plainWalk.ts";

type Path = (string | number)[];

/**
 * Report rule `type` at each value under undeclared data that is not plain data (a `Secret` among them) and at each
 * container met again inside itself, at any depth, without reading under it (k.schema Plain data).
 */
export function scanExtras(x: unknown, path: Path, issues: Issue[]): void {
  plainWalk(x, (keys) => {
    issues.push({ path: [...path, ...keys], rule: "type" });
    return true;
  });
}
