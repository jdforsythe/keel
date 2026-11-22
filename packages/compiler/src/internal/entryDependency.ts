import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Whether a `node_modules/<id>` folder holds a package at `dir` or above it: the lookup Vite resolves a bare specifier by. */
const found = (id: string, dir: string): boolean => {
  if (fs.existsSync(path.join(dir, "node_modules", ...id.split("/"), "package.json"))) return true;
  const up = path.dirname(dir);
  return up !== dir && found(id, up);
};

/**
 * The file a bare `@keel/` package specifier the generated entry imports names, when the project at `root` has no such
 * package: resolved from the compiler's own dependencies (`from`, the compiler's module URL), so an app need not list a
 * kernel package only the generated entry imports (an app without stores imports no `@keel/store`). Undefined for any
 * other specifier, a package the project has (Vite resolves it there, so the app and the entry share one instance), or
 * one the compiler cannot resolve either (Vite reports it).
 */
export function entryDependency(id: string, root: string, from: string = import.meta.url): string | undefined {
  const name = /^@keel\/[^/]+/.exec(id)?.[0];
  if (name === undefined || found(name, root)) return undefined;
  try {
    return createRequire(from).resolve(id);
  } catch {
    return undefined;
  }
}
