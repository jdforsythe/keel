import fs from "node:fs";
import path from "node:path";
import { evaluateProject } from "./evaluateProject.ts";

/**
 * What a document's first paint follows (k.schemes First paint): whether the app's tokens have both schemes, and
 * their `choice` themes in `themes` order (`evaluateProject`). No `tokens.ts`: one scheme and no themes.
 */
export async function firstPaint(
  root: string,
): Promise<{ readonly both: boolean; readonly themes: readonly string[] }> {
  if (!fs.existsSync(path.join(root, "tokens.ts"))) return { both: false, themes: [] };
  const r = await evaluateProject({ root, tokensFile: "tokens.ts", routesFiles: [], usages: [] });
  return { both: r.schemes.includes("light") && r.schemes.includes("dark"), themes: r.themes };
}
