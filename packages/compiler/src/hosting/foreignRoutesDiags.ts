import path from "node:path";
import { parseSync } from "oxc-parser";
import { lineCol } from "../internal/lineCol.ts";
import { parseTopology } from "../internal/parseTopology.ts";
import { stdPlacedExports } from "../std/stdPlacedExports.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";

const SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** The project file a relative import `from` of `file` names, when there is one. */
function resolve(files: ReadonlyMap<string, SourceFile>, file: string, from: string): SourceFile | undefined {
  if (!from.startsWith(".")) return undefined;
  const base = path.posix.join(path.posix.dirname(file), from);
  for (const s of SUFFIXES) {
    const hit = files.get(base + s);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * E1592 (k.user Rules): `identity.server.ts`, or a project file it imports (transitively, relative imports of project
 * files), importing a module's `routes` (`modules/<id>/routes.ts`, or with `root` a stdlib package's `./routes`
 * export placed as module `<id>`) where a `static` deployable of `topology.ts`, or a `client` one without `servedBy`,
 * serves `<id>`: at that import declaration. No fix.
 */
export function foreignRoutesDiags(files: readonly SourceFile[], root?: string): Diagnostic[] {
  const top = files.find((f) => f.path === "topology.ts");
  const entry = files.find((f) => f.path === "identity.server.ts");
  if (top === undefined || entry === undefined) return [];
  const deployables = Object.values(parseTopology(top.source).topology);
  const bare = (id: string): boolean =>
    deployables.some(
      (d) => d.modules.includes(id) && (d.adapter === "static" || (d.adapter === "client" && d.servedBy === undefined)),
    );
  const std = new Map<string, string>();
  if (root !== undefined)
    for (const d of deployables)
      for (const id of d.modules) {
        const found = stdPlacedExports(root, id, files);
        if (found?.routes) std.set(`${found.name}/routes`, id);
      }
  const byPath = new Map(files.map((f) => [f.path, f]));
  const seen = new Set<string>([entry.path]);
  const out: Diagnostic[] = [];
  for (const queue = [entry]; queue.length > 0; ) {
    const file = queue.shift();
    if (file === undefined) break;
    const { program } = parseSync(file.path, file.source, {
      sourceType: "module",
      lang: file.path.endsWith("x") ? "tsx" : "ts",
    });
    for (const s of program.body) {
      if (
        (s.type !== "ImportDeclaration" && s.type !== "ExportNamedDeclaration" && s.type !== "ExportAllDeclaration") ||
        s.source === null
      )
        continue;
      const from = s.source.value;
      const target = resolve(byPath, file.path, from);
      const id =
        std.get(from) ?? (target === undefined ? undefined : /^modules\/([^/]+)\/routes\.tsx?$/.exec(target.path)?.[1]);
      if (id !== undefined && bare(id))
        out.push({
          code: "E1592",
          path: file.path,
          ...lineCol(file.source, s.start),
          message: `${id} pages are on another origin; a sign-in cannot return there`,
          see: "k.user",
        });
      if (target !== undefined && !seen.has(target.path)) {
        seen.add(target.path);
        queue.push(target);
      }
    }
  }
  return out;
}
