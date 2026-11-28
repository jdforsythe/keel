import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { check } from "@keel/check";
import { expect, it } from "vitest";
import { tokens } from "../tokens.ts";

const app = join(import.meta.dirname, "..");
const library = "node_modules/@example/library-looks";

/** The files under `dir` (relative to `base`) whose names pass `keep`, as `{ path, source }`. */
function under(base: string, dir: string, keep: (name: string) => boolean, prefix: string) {
  return readdirSync(join(base, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && keep(entry.name))
    .map((entry) => {
      const rel = join(dir, join(entry.parentPath, entry.name).slice(join(base, dir).length + 1));
      return { path: `${prefix}${rel}`, source: readFileSync(join(base, rel), "utf8") };
    });
}

const source = (base: string, rel: string, prefix: string) => ({
  path: `${prefix}${rel}`,
  source: readFileSync(join(base, rel), "utf8"),
});

const appFiles = [
  source(app, "package.json", ""),
  source(app, "tokens.ts", ""),
  source(app, "topology.ts", ""),
  ...under(app, "modules", (name) => /\.tsx?$/.test(name), ""),
];
const libraryBase = join(app, library);
const libraryFiles = [
  source(libraryBase, "package.json", `${library}/`),
  source(libraryBase, "module.ts", `${library}/`),
  ...under(libraryBase, "src", (name) => /\.tsx?$/.test(name), `${library}/`),
];

it("reports a library pair's contrast failure in tokens.ts, never under node_modules", () => {
  const failing = { ...tokens, color: { ...tokens.color, "acme.onAccent": "#cccccc" } };
  const result = check([...appFiles, ...libraryFiles], { root: app, types: false, artifacts: { tokens: failing } });
  const contrast = result.diagnostics.filter((diag) => diag.code === "E1804");
  // One finding per pair and combination (k.a11y-static Library contrast), each in tokens.ts.
  expect(contrast.length).toBeGreaterThan(0);
  expect(new Set(contrast.map((diag) => diag.path))).toEqual(new Set(["tokens.ts"]));
  expect(new Set(contrast.map((diag) => diag.message)).size).toBe(contrast.length);
  // A message over 89 units keeps its first 86 and ends `...` (k.a11y-static Message).
  for (const diag of contrast) expect(diag.message).toMatch(/; override in tokens\.ts$|\.\.\.$/);
  expect(result.diagnostics.filter((diag) => diag.path.startsWith("node_modules/"))).toEqual([]);
});
