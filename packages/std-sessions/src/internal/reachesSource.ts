import path from "node:path";
import { parseTs } from "./parseTs.ts";
import { sourcesOf } from "./sourcesOf.ts";

type File = { readonly path: string; readonly source: string };

const JS_TO_TS: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
};

/**
 * The project file a relative specifier from `from` names, else undefined: as written, with `.ts`/`.tsx`, as a
 * directory `index.ts`/`index.tsx`, or a `.js`/`.jsx`/`.mjs` specifier mapped to its TypeScript source.
 */
function resolve(project: readonly File[], from: string, spec: string): File | undefined {
  if (!spec.startsWith(".")) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  const ext = path.posix.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  const mapped = (JS_TO_TS[ext] ?? []).map((e) => `${stem}${e}`);
  const candidates = [base, ...mapped, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.flatMap((p) => project.filter((f) => f.path === p))[0];
}

/**
 * Whether `spec`, imported or re-exported from `from`, leads to `target`: it is `target`, or it names a project file
 * that imports or re-exports `target`, directly or through further project files (each file read once).
 */
export function reachesSource(
  project: readonly File[],
  from: string,
  spec: string,
  target: string,
  seen: Set<string> = new Set(),
): boolean {
  if (spec === target) return true;
  const file = resolve(project, from, spec);
  if (file === undefined || seen.has(file.path)) return false;
  seen.add(file.path);
  const program = parseTs(file.path, file.source);
  if (program === undefined) return false;
  return sourcesOf(program).some((s) => reachesSource(project, file.path, s.value, target, seen));
}
