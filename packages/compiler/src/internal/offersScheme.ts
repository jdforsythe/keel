import fs from "node:fs";
import path from "node:path";
import { evaluateProject } from "./evaluateProject.ts";
import { listSources } from "./listSources.ts";

/** A module file that imports `SchemeSelect` from `@keel/ui`. */
const SCHEME_SELECT = /import\s*\{[^}]*\bSchemeSelect\b[^}]*\}\s*from\s*["']@keel\/ui["']/;

/**
 * Whether a `client` or `static` deployable over `modules` loads the first-paint scheme script (k.schemes First
 * paint): the app's tokens have both schemes (`evaluateProject`) and a file of one of its modules imports
 * `SchemeSelect` from `@keel/ui`.
 */
export async function offersScheme(root: string, modules: readonly string[]): Promise<boolean> {
  const renders = listSources(root).some(
    (rel) =>
      modules.some((m) => rel.startsWith(`modules/${m}/`)) &&
      SCHEME_SELECT.test(fs.readFileSync(path.join(root, rel), "utf8")),
  );
  if (!renders || !fs.existsSync(path.join(root, "tokens.ts"))) return false;
  const r = await evaluateProject({ root, tokensFile: "tokens.ts", routesFiles: [], usages: [] });
  return r.schemes.includes("light") && r.schemes.includes("dark");
}
