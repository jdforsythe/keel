import fs from "node:fs";
import path from "node:path";
import { evaluateProject } from "./evaluateProject.ts";

/**
 * Whether a `client` or `static` deployable loads the first-paint scheme script (k.schemes First paint): the app's
 * tokens have both schemes (`evaluateProject`). No text match decides it, since none sees every `SchemeSelect`.
 */
export async function offersScheme(root: string): Promise<boolean> {
  if (!fs.existsSync(path.join(root, "tokens.ts"))) return false;
  const r = await evaluateProject({ root, tokensFile: "tokens.ts", routesFiles: [], usages: [] });
  return r.schemes.includes("light") && r.schemes.includes("dark");
}
