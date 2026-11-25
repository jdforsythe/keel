import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ReadPackage } from "./ReadPackage.ts";
import { projectRoots } from "./projectRoots.ts";
import { specifierFile } from "./specifierFile.ts";
import { tsCompilerOptions } from "./tsCompilerOptions.ts";

const SOURCE = /\.(?:ts|tsx|mts)$/;
const SKIP = new Set(["node_modules", "dist", "test", "tests", "conformance", "__tests__"]);
const options = tsCompilerOptions();
/** Per project: each package read, by its folder, and each specifier's answer, by importing folder. */
const loaded = new WeakMap<readonly SourceFile[], Map<string, ReadPackage | null>>();
/** Where each package file was read from, so a package's own imports of other packages resolve from it. */
const origins = new WeakMap<SourceFile, string>();

/** The code files under `dir` (no `node_modules`, build output or tests), each with its path relative to `dir`. */
function codeFiles(dir: string, rel = ""): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const at = rel === "" ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith(".")) out.push(...codeFiles(dir, at));
    else if (e.isFile() && SOURCE.test(e.name) && !e.name.endsWith(".d.ts") && !/\.(?:test|spec)\./.test(e.name))
      out.push({ rel: at, abs: path.join(dir, at) });
  }
  return out;
}

/** The nearest folder at or above `file` holding a `package.json` with a `name`, and that name. */
function packageOf(file: string): { dir: string; name: string } | undefined {
  for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const manifest = path.join(dir, "package.json");
    if (!fs.existsSync(manifest)) continue;
    const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const name = typeof parsed === "object" && parsed !== null && "name" in parsed ? parsed.name : undefined;
    return typeof name === "string" ? { dir, name } : undefined;
  }
  return undefined;
}

/** The package `real` (a source file's real path) belongs to, every code file of it read once per project. */
function wholePackage(real: string, cache: Map<string, ReadPackage | null>): ReadPackage | undefined {
  const pkg = packageOf(real);
  if (pkg === undefined) return undefined;
  const key = `\u0000dir\u0000${pkg.dir}`;
  let whole = cache.get(key) ?? undefined;
  if (whole === undefined) {
    const files = codeFiles(pkg.dir).map(({ rel, abs }) => {
      const f: SourceFile = { path: abs.split(path.sep).join("/"), source: fs.readFileSync(abs, "utf8") };
      origins.set(f, abs);
      return f;
    });
    const first = files[0];
    if (first === undefined) return undefined;
    whole = { entry: first, files };
    cache.set(key, whole);
  }
  const at = real.split(path.sep).join("/");
  const entry = whole.files.find((f) => f.path === at);
  return entry === undefined ? undefined : { entry, files: whole.files };
}

/**
 * The source of the package `specifier` (no query) names from `from`, a file of `project` or of a package read for it
 * (k.privacy-reads Factories): resolved as the type check resolves it (bundler resolution, `exports`, symlinks
 * followed, from the project's root on disk), kept only when it lands on a `.ts` or `.tsx` file that is not a
 * declaration file, as a workspace package's `exports` give; undefined for a package that ships only built code and
 * its types, or none. Each package is read once per project.
 */
export function packageSource(
  specifier: string,
  from: SourceFile,
  project: readonly SourceFile[],
): ReadPackage | undefined {
  const root = projectRoots.get(project);
  const at = origins.get(from) ?? (root === undefined ? undefined : path.join(root, from.path));
  if (at === undefined) return undefined;
  const cache = loaded.get(project) ?? new Map<string, ReadPackage | null>();
  loaded.set(project, cache);
  const key = `${path.dirname(at)}\u0000${specifier}`;
  const known = cache.get(key);
  if (known !== undefined) return known ?? undefined;
  const resolution = ts.createModuleResolutionCache(path.dirname(at), (s) => s, options);
  const hit = specifierFile(specifier, at, options, resolution);
  let found: ReadPackage | undefined;
  if (hit !== undefined && SOURCE.test(hit) && !hit.endsWith(".d.ts") && fs.existsSync(hit))
    found = wholePackage(fs.realpathSync(hit), cache);
  cache.set(key, found ?? null);
  return found;
}
