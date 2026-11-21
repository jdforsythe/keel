import fs from "node:fs";
import path from "node:path";
import { exportOf } from "./exportOf.ts";

/**
 * The source of the stdlib module manifest of the package in directory `pkg`: the file its `./module` export names
 * (`module.ts` in the monorepo, the built `dist/module.js` in an installed package), else the `module.ts` in the
 * package's root. Undefined when neither can be read.
 */
export function manifestSource(pkg: string): string | undefined {
  try {
    return fs.readFileSync(exportOf(pkg, "./module")?.[0] ?? path.join(pkg, "module.ts"), "utf8");
  } catch {
    return undefined;
  }
}
