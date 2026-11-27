import { projectDirs } from "@keel/compiler";
import { SERVER_ONLY_NAME, clientReach } from "@keel/compiler/internal";
import type { Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { dirPrograms } from "./dirPrograms.ts";
import { isTestPath } from "./isTestPath.ts";
import { projectLibraries } from "./projectLibraries.ts";
import { reachResolve } from "./reachResolve.ts";
import { tokensFamily } from "./tokensFamily.ts";
import { topologyFor } from "./topologyFor.ts";
import { valueImportSites } from "./valueImportSites.ts";

/** The entries that run under Node only (k.check-time Entries). */
const ENTRIES: ReadonlySet<string> = new Set(["@keel/ui/tokens", "@keel/ui/css"]);
const CONFIG = /\.config\.[cm]?[jt]sx?$/;

/** An E1818 at a client entry's import: the specifier's opening quote, the reached file's path from the project root and the entry it imports. */
type Report = { readonly start: number; readonly file: string; readonly entry: string };

/** What E1818 reads of one file (k.check-time). */
type Read = {
  /** Whether the file is of an exempt kind: server-only, test code, a `*.config.*` file, or a `tokensFamily` file. */
  readonly exempt: boolean;
  /** Whether the file is a client entry. */
  readonly entry: boolean;
  /** The E1818 at this file's imports for the exempt-kind files they reach, when it is a client entry. */
  readonly reports: readonly Report[];
};

type Dir = {
  readonly exempt: (p: string) => boolean;
  readonly entries: ReadonlySet<string>;
  readonly reports: (p: string) => readonly Report[];
};

const dirs = new WeakMap<readonly SourceFile[], Map<string, Dir>>();

/** One project folder `dir`'s exempt kinds, client entries and each entry's reports (k.boundary Following). */
function readDir(dir: string, project: readonly SourceFile[]): Dir {
  const topology = topologyFor(dir, project);
  const read = topology?.dir === dir ? topology : undefined;
  const files = dirPrograms(dir, project);
  const byPath = new Map<string, Program>(files.map((f) => [f.path, f.program]));
  const resolve = reachResolve(project, dir, new Set(byPath.keys()));
  const real = projectLibraries.get(project)?.real ?? ((p: string): string => p);
  const clientOnly = (p: string): boolean => {
    const m = /^modules\/([^/]+)\//.exec(p)?.[1];
    const owners = Object.values(read?.topology ?? {}).filter((d) => m !== undefined && d.modules.includes(m));
    return owners.length > 0 && owners.every((d) => d.adapter === "client");
  };
  const serverOnly = (p: string): boolean => SERVER_ONLY_NAME.test(p) && !clientOnly(p);
  const exempt = (p: string): boolean =>
    serverOnly(p) || isTestPath(p) || CONFIG.test(p) || tokensFamily(`${dir}${p}`, project);
  const next = (at: string): string[] => {
    const program = byPath.get(at);
    return (program === undefined ? [] : valueImportSites(program))
      .map((s) => resolve(at, s.spec))
      .filter((p): p is string => p !== undefined && !serverOnly(p));
  };
  const entries: ReadonlySet<string> =
    read === undefined
      ? new Set(files.map((f) => f.path).filter((p) => !exempt(p)))
      : new Set(clientReach(files, read.topology, resolve).entries);
  const library = projectLibraries.get(project)?.files;
  /** What `start` reaches through no client entry outside `node_modules/`, which reports for itself. */
  const reachFrom = (start: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i] ?? "";
      if (seen.has(at) || (entries.has(at) && library?.has(`${dir}${at}`) !== true)) continue;
      seen.add(at);
      out.push(at);
      queue.push(...next(at));
    }
    return out;
  };
  const imported = (p: string): string | undefined => {
    const program = byPath.get(p);
    return program === undefined ? undefined : valueImportSites(program).find((s) => ENTRIES.has(s.spec))?.spec;
  };
  const reports = (p: string): readonly Report[] => {
    const program = byPath.get(p);
    if (program === undefined || !entries.has(p)) return [];
    const out: Report[] = [];
    for (const s of valueImportSites(program)) {
      const first = resolve(p, s.spec);
      if (first === undefined || serverOnly(first)) continue;
      for (const file of reachFrom(first)) {
        const entry = exempt(file) ? imported(file) : undefined;
        if (entry !== undefined) out.push({ start: s.start, file: real(`${dir}${file}`).slice(dir.length), entry });
      }
    }
    return out;
  };
  return { exempt, entries, reports };
}

/**
 * What E1818 reads of `path` (k.check-time): whether it is of an exempt kind, whether it is a client entry, and, for
 * a client entry, one report per value import and exempt-kind file importing `@keel/ui/tokens` or `@keel/ui/css`
 * that the import reaches, through no server-only file and no client entry outside `node_modules/`, naming the entry of that file's first such import. Client
 * entries come from `clientReach` over the project's `topology.ts` directory; with none, every code file of no exempt
 * kind is one (k.boundary Reach). Undefined for a file in no project folder.
 */
export function checkTimeReach(path: string, project: readonly SourceFile[]): Read | undefined {
  const dir =
    topologyFor(path, project)?.dir ??
    projectDirs(project.map((f) => ({ path: f.path, source: f.source }))).find((d) => path.startsWith(d));
  if (dir === undefined) return undefined;
  const byDir = dirs.get(project) ?? new Map<string, Dir>();
  dirs.set(project, byDir);
  const d = byDir.get(dir) ?? readDir(dir, project);
  byDir.set(dir, d);
  const p = path.slice(dir.length);
  return { exempt: d.exempt(p), entry: d.entries.has(p), reports: d.reports(p) };
}
