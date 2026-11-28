import fs from "node:fs";
import path from "node:path";

/** The files a browser reads as CSS, script or markup. */
const TEXT = /\.(?:css|js|mjs|cjs|html?|svg)$/;

/**
 * The stylesheets, scripts and documents under `out` as written to disk, each by its `/`-separated path under `out`,
 * in path order (k.gamut CSS reads them after the build has written everything); none when `out` is missing.
 */
export function builtTextFiles(out: string): { path: string; text: string }[] {
  if (!fs.existsSync(out)) return [];
  return fs
    .readdirSync(out, { recursive: true, encoding: "utf8" })
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => TEXT.test(f) && fs.statSync(path.join(out, f)).isFile())
    .sort()
    .map((f) => ({ path: f, text: fs.readFileSync(path.join(out, f), "utf8") }));
}
