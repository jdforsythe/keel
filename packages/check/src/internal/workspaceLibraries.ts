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

/**
 * The libraries of a project's own tree (k.library Kind): a folder below a project's root, outside `node_modules/`, that
 * is no project itself, whose `package.json` marks it `"keel": "library"` under a scoped name. `twin` is true of a code
 * file under its `src/` or `unsafe/` when the same project reads that library through `node_modules/<name>/` too, so
 * the file is read once, there; `inPlace` is true of one it reads where it lies, as a library's file.
 */
export function workspaceLibraries(files: readonly SourceFile[]): {
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
    found.push({ dir, viewed: paths.has(`${project}node_modules/${name}/package.json`) });
  }
  const of = (p: string) => found.find((l) => p.startsWith(l.dir) && /^(?:src|unsafe)\//.test(p.slice(l.dir.length)));
  return {
    twin: (p) => of(p)?.viewed === true,
    inPlace: (p) => of(p)?.viewed === false,
  };
}
