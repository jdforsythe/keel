// The units a mutation run covers: every `packages/<name>` and `apps/<name>` with a `stryker.config.mjs`. A bare name is
// a package; an app is written `apps/<name>`. A package mutates `src/`, an app `modules/`.
import fs from "node:fs";
import path from "node:path";

/** The directory of a mutation unit, repo-relative: `apps/<name>` as written, a bare name is `packages/<name>`. */
export const unitDir = (unit) => (unit.includes("/") ? unit : `packages/${unit}`);

/** The folder a unit's mutated files live in: `modules` for an app, `src` for a package. */
export const sourceDir = (unit) => (unitDir(unit).startsWith("apps/") ? "modules" : "src");

/** The path rule of a mutated file, unit-relative (the one `mutate-changed` and Stryker's `mutate` globs use). */
export const mutatedRule = (unit) => new RegExp(`^${sourceDir(unit)}/(?!index\\.ts$)(?!types/).+\\.ts$`);

/** The units under `root` that have a Stryker config: packages by name, then `apps/<name>`, each sorted. */
export function mutationUnits(root) {
  const out = [];
  for (const [parent, label] of [
    ["packages", (n) => n],
    ["apps", (n) => `apps/${n}`],
  ]) {
    const dir = path.join(root, parent);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir).sort())
      if (fs.existsSync(path.join(dir, n, "stryker.config.mjs"))) out.push(label(n));
  }
  return out;
}
