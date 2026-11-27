import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";

/** The nearest folder above `dir` that holds a `node_modules`, where module resolution from `dir` goes on to. */
function outerModules(dir: string): string | undefined {
  for (let at = dirname(dir); at !== dirname(at); at = dirname(at))
    if (existsSync(join(at, "node_modules"))) return join(at, "node_modules");
  return undefined;
}

/**
 * A temporary project root standing in for `app`, a project of this repository, for a test that checks or builds over
 * the app's sources: its `node_modules` is a folder of its own holding a link to each entry of the app's (its `.cache`
 * left out), beside a copy of the app's `package.json`, and the folder above it links the `node_modules` resolution
 * reaches above the app (the repository root's). Imports resolve as they do from the app, while what a run writes under
 * the root, the type cache in `node_modules/.cache/keel` (k.check-cache) among it, stays in the temporary folder and
 * never reaches the app. `remove` deletes the folder.
 */
export function linkedProject(app: string): { root: string; remove: () => void } {
  const outer = realpathSync(tempDir("keel-cli-project-"));
  const above = outerModules(app);
  if (above !== undefined) symlinkSync(above, join(outer, "node_modules"));
  const root = join(outer, "project");
  const modules = join(root, "node_modules");
  mkdirSync(modules, { recursive: true });
  for (const name of readdirSync(join(app, "node_modules")))
    if (name !== ".cache") symlinkSync(join(app, "node_modules", name), join(modules, name));
  if (existsSync(join(app, "package.json"))) copyFileSync(join(app, "package.json"), join(root, "package.json"));
  return { root, remove: () => rmSync(outer, { recursive: true, force: true }) };
}
