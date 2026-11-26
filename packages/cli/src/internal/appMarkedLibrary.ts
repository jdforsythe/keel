import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Diag } from "./Diag.ts";
import { isRecord } from "./isRecord.ts";
import { jsonFieldAt } from "./jsonFieldAt.ts";
import { makeDiag } from "./makeDiag.ts";

/**
 * Binary only: k.module E1170 for `cwd`, an app's folder (one holding `topology.ts` or a `modules/<id>/module.ts`) whose `package.json`
 * says `"keel": "library"`, at that key; undefined for any other folder. Such a folder is no library's own folder
 * (k.library-pack Own folder): `keel check` reads it as an app, and `keel pack` stops with this diagnostic.
 */
export function appMarkedLibrary(cwd: string): Diag | undefined {
  if (!existsSync(join(cwd, "topology.ts")) && !holdsModule(cwd)) return undefined;
  let text: string;
  let pkg: unknown;
  try {
    text = readFileSync(join(cwd, "package.json"), "utf8");
    pkg = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(pkg) || pkg.keel !== "library") return undefined;
  return makeDiag("E1170", `an app's folder is no library's own folder; drop "keel": "library"`, {
    path: "package.json",
    ...(jsonFieldAt(text, "keel") ?? { line: 1, col: 1 }),
    see: "k.module",
  });
}

/** Whether `cwd` holds an app module's manifest, `modules/<id>/module.ts`. */
function holdsModule(cwd: string): boolean {
  let ids: string[];
  try {
    ids = readdirSync(join(cwd, "modules"));
  } catch {
    return false;
  }
  return ids.some((id) => existsSync(join(cwd, "modules", id, "module.ts")));
}
