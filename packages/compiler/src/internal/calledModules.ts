import path from "node:path";
import { SERVER_ONLY_NAME } from "./SERVER_ONLY_NAME.ts";

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']*)["']/g;
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];
const INDEXES = EXTENSIONS.slice(1).map((e) => `index${e}`);

/** The file system a scan reads: a file's text (undefined when there is none) and a folder's file names. */
export interface ModuleFiles {
  readonly read: (file: string) => string | undefined;
  readonly list: (dir: string) => readonly string[];
}

/**
 * The app modules whose files a `client` deployable's browser code imports (k.hosting Peers): the entry binds a
 * `service({ contract })` target for these only, so the browser build holds no other module's name. Starting from each file
 * of `own` (module folders under `modules/`, root-relative, `/`-separated), it follows relative imports through
 * files that are not server-only and collects the `modules/<id>/` each one lands in.  Returns those ids, sorted;
 * `own` themselves are left out.
 */
export function calledModules(own: readonly string[], files: ModuleFiles): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  const queue: string[] = [];
  const walk = (dir: string): void => {
    for (const name of files.list(dir)) {
      const file = `${dir}/${name}`;
      if (files.read(file) !== undefined) queue.push(file);
      else walk(file);
    }
  };
  for (const m of own) walk(`modules/${m}`);
  const resolve = (from: string, spec: string): string | undefined => {
    const base = path.posix.join(path.posix.dirname(from), spec);
    const candidates = [...EXTENSIONS.map((e) => `${base}${e}`), ...INDEXES.map((i) => `${base}/${i}`)];
    return candidates.find((c) => files.read(c) !== undefined);
  };
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file) || SERVER_ONLY_NAME.test(path.posix.basename(file))) continue;
    seen.add(file);
    const text = files.read(file) ?? "";
    for (const match of text.matchAll(SPECIFIER)) {
      const target = resolve(file, match[1] ?? "");
      if (target === undefined) continue;
      const id = /^modules\/([^/]+)\//.exec(target)?.[1];
      if (id !== undefined && !own.includes(id)) found.add(id);
      queue.push(target);
    }
  }
  return [...found].sort();
}
