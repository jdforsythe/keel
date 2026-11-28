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
 * The file a bare `@keel/` specifier (a subpath included: `@keel/store/internal`) names when the project at `root` has
 * no such package: resolved from the dependencies of the module at `from` (by default the compiler's), so an app need
 * not list a kernel package only generated or tooling code imports (an app without stores imports no `@keel/store`;
 * the generated entries import it, the surface evaluation loads `@keel/store/internal`). Undefined for any other
 * specifier, a package the project has (it resolves there, so the app and the generated code share one instance), or
 * one `from` cannot resolve either (the caller reports it).
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
