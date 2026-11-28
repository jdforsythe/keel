import fs from "node:fs";
import path from "node:path";
import { projectDirs } from "@keel/compiler";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { SourceFile } from "../types/SourceFile.ts";

const MANIFEST = /^((?:(?!node_modules\/).)*\/)?package\.json$/;

/** The parsed JSON of `source`; undefined when it does not parse. */
function parse(source: string): unknown {
  try {
    const v: unknown = JSON.parse(source);
    return v;
  } catch {
    return undefined;
  }
}

/** The real path of `p` on disk; undefined when nothing is there. */
function realOf(p: string): string | undefined {
  try {
    return fs.realpathSync(p);
  } catch {
    return undefined;
  }
}

/**
 * Whether the library folder `dir` and `<project>node_modules/<name>/` are one folder: by real path under `root` when
 * both are on disk (a link), else, for files given in memory only, by the text of every file the two hold.
 */
function sameFolder(files: readonly SourceFile[], root: string, dir: string, linked: string): boolean {
  const a = realOf(path.resolve(root, dir));
  const b = realOf(path.resolve(root, linked));
  if (a !== undefined || b !== undefined) return a === b;
  const under = (prefix: string) =>
    new Map(files.filter((f) => f.path.startsWith(prefix)).map((f) => [f.path.slice(prefix.length), f.source]));
  const mine = under(dir);
  const there = under(linked);
  return mine.size === there.size && [...mine].every(([rel, text]) => there.get(rel) === text);
}

/**
 * The libraries of a project's own tree (k.library Kind): a folder below a project's root, outside `node_modules/`, that
 * is no project itself, whose `package.json` marks it `"keel": "library"` under a scoped name. `twin` is true of a code
 * file under its `src/` or `unsafe/` when the same project's `node_modules/<name>/` is that folder (`sameFolder`), so
 * the file is read once, there; `inPlace` is true of one it reads where it lies, as a library's file. A different copy
 * installed under the same name is another library: the folder is read in place and the copy through `node_modules/`.
 */
export function workspaceLibraries(
  files: readonly SourceFile[],
  root: string = process.cwd(),
): {
  readonly twin: (path: string) => boolean;
  readonly inPlace: (path: string) => boolean;
} {
  const dirs = projectDirs(files);
  const paths = new Set(files.map((f) => f.path));
  const found: { readonly dir: string; readonly viewed: boolean }[] = [];
  for (const f of files) {
    const dir = MANIFEST.exec(f.path)?.[1];
    if (dir === undefined || dirs.includes(dir)) continue;
    const pkg = parse(f.source);
    const name = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "name") : undefined;
    if (typeof name !== "string" || libraryKind(pkg, name) !== "library") continue;
    const project = dirs.find((d) => dir.startsWith(d)) ?? "";
    const linked = `${project}node_modules/${name}/`;
    found.push({ dir, viewed: paths.has(`${linked}package.json`) && sameFolder(files, root, dir, linked) });
  }
  const of = (p: string) => found.find((l) => p.startsWith(l.dir) && /^(?:src|unsafe)\//.test(p.slice(l.dir.length)));
  return {
    twin: (p) => of(p)?.viewed === true,
    inPlace: (p) => of(p)?.viewed === false,
  };
}
