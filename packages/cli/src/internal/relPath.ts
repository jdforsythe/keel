import { posix } from "node:path";

/** A project-relative path: strips `cwd/` and `./`; any other absolute path is made relative to `cwd`. */
export function relPath(cwd: string, p: string): string {
  const base = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
  if (p.startsWith(`${base}/`)) return p.slice(base.length + 1);
  if (p.startsWith("/")) return posix.relative(base, p);
  return p.startsWith("./") ? p.slice(2) : p;
}
