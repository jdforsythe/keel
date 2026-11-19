import path from "node:path";
import { type Program, Visitor } from "oxc-parser";
import type { Topology } from "../types/Topology.ts";

/** A server-only import E1004 reports: where, what, and the chain from a client entry when one reaches the file. */
export type ReachHit = {
  readonly path: string;
  readonly start: number;
  readonly source: string;
  readonly chain?: string;
};

const NAME = /\.(?:server|guard)(?:\.[cm]?[jt]sx?)?$/;
const TEST = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const EXT = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
const ROUTES = /(?:^|\/)routes\.ts$/;

/** Value imports, re-exports and literal `import()` of `program`. */
function edges(program: Program): { source: string; start: number }[] {
  const out: { source: string; start: number }[] = [];
  for (const s of program.body) {
    const value =
      s.type === "ImportDeclaration" ? s.importKind !== "type" : "exportKind" in s && s.exportKind !== "type";
    const from = "source" in s ? s.source : null;
    if (value && from !== null && from !== undefined && "value" in from && typeof from.value === "string")
      out.push({ source: from.value, start: s.start });
  }
  new Visitor({
    ImportExpression: (n) => {
      if (n.source.type === "Literal" && typeof n.source.value === "string")
        out.push({ source: n.source.value, start: n.start });
    },
  }).visit(program);
  return out;
}

/**
 * Client-reachable code (k.boundary Reach) over one project's files (root-relative paths). With `topology`: the files of
 * a `node` or `static` module that are not server-only, and every file a client entry (each route `component` such a
 * module's `routes.ts` names, every file of a `client` module) reaches by value imports through no server-only file.
 * With none, every file but server-only ones. `hits` are their imports of server-only files (a query names its file;
 * a `routes.ts` reports none), with the chain when an entry reaches the importer.
 */
export function clientReach(
  files: readonly { readonly path: string; readonly program: Program }[],
  topology: Topology | undefined,
): { readonly subject: ReadonlySet<string>; readonly hits: readonly ReachHit[] } {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const owners = (p: string) => {
    const m = /^modules\/([^/]+)\//.exec(p)?.[1];
    return Object.values(topology ?? {}).filter((d) => m !== undefined && d.modules.includes(m));
  };
  const client = (p: string): boolean => owners(p).length > 0 && owners(p).every((d) => d.adapter === "client");
  const serverOnly = (p: string): boolean => NAME.test(p) && !client(p);
  const target = (from: string, source: string): { file: string | undefined; name: string; server: boolean } => {
    const spec = source.split("?")[0] ?? source;
    if (!spec.startsWith(".")) return { file: undefined, name: spec, server: NAME.test(spec) };
    const at = path.posix.join(path.posix.dirname(from), spec);
    const file = EXT.map((e) => at + e).find((c) => byPath.has(c));
    return { file, name: file ?? at, server: serverOnly(file ?? at) };
  };
  const subject = new Set<string>();
  for (const f of files)
    if (!serverOnly(f.path) && (topology === undefined || owners(f.path).some((d) => d.adapter !== "client")))
      subject.add(f.path);
  const entries: string[] = [];
  for (const f of files) {
    if (topology === undefined || TEST.test(f.path)) continue;
    if (client(f.path)) entries.push(f.path);
    if (!ROUTES.test(f.path) || !subject.has(f.path)) continue;
    const bound = new Map<string, string>();
    for (const s of f.program.body)
      if (s.type === "ImportDeclaration") for (const sp of s.specifiers) bound.set(sp.local.name, s.source.value);
    new Visitor({
      Property: (p) => {
        const v = p.value;
        const key = p.key.type === "Identifier" ? p.key.name : "";
        const from = v.type === "Identifier" ? bound.get(v.name) : undefined;
        const file = key === "component" && from !== undefined ? target(f.path, from).file : undefined;
        if (file !== undefined && !serverOnly(file)) entries.unshift(file);
      },
    }).visit(f.program);
  }
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  const hits: ReachHit[] = [];
  const chainOf = (p: string): string => {
    const up = parent.get(p);
    return typeof up === "string" ? `${chainOf(up)} -> ${p}` : p;
  };
  const visit = (p: string, walk: boolean): void => {
    const f = byPath.get(p);
    for (const e of f === undefined ? [] : edges(f.program)) {
      const t = target(p, e.source);
      if (t.server && !ROUTES.test(p))
        hits.push({
          path: p,
          start: e.start,
          source: e.source,
          ...(walk ? { chain: `${chainOf(p)} -> ${t.name}` } : {}),
        });
      if (walk && !t.server && t.file !== undefined && !parent.has(t.file)) {
        parent.set(t.file, p);
        queue.push(t.file);
      }
    }
  };
  for (const e of entries)
    if (!parent.has(e)) {
      parent.set(e, null);
      queue.push(e);
    }
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i] ?? "";
    subject.add(p);
    visit(p, true);
  }
  for (const p of subject) if (!parent.has(p)) visit(p, false);
  return { subject, hits };
}
