import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { compile, contractCallers, isSourcePath, parseTopology } from "@keel/compiler";
import { entryDependency } from "@keel/compiler/internal/entry/entryDependency";
import { stdContract } from "@keel/compiler/std/stdContract";
import { stdRoutes } from "@keel/compiler/std/stdRoutes";
import { createViteServer } from "vitest/node";
import { applyWrites } from "./applyWrites.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { hashOf } from "./hashOf.ts";
import { isRecord } from "./isRecord.ts";
import { readProject } from "./readProject.ts";
import { surfaceOf } from "./surfaceOf.ts";

const CONTRACT = /^modules\/([^/]+)\/([^/]+)\.contract\.ts$/;
const ROUTES = /^modules\/[^/]+\/routes\.tsx?$/;
/** A kernel internal the evaluation loads: the project's package, else the CLI's own dependency (`entryDependency`). */
const kernel = (id: string, root: string): string => entryDependency(id, root, import.meta.url) ?? id;
const firstLine = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";
/** An E code a thrown value carries (`{ code: "E1502" }`), kept as k.compiler Build-time evaluation keeps it. */
const codeOf = (e: unknown): string | undefined => {
  const code: unknown = isRecord(e) || e instanceof Error ? Reflect.get(e, "code") : undefined;
  return typeof code === "string" && /^E\d{4}$/.test(code) ? code : undefined;
};
/** The note of a file that failed to evaluate: E1006 with the first 60 characters of the message's first line. */
const failed = (file: string, e: unknown): string => `E1006 ${file} failed to evaluate: ${firstLine(e).slice(0, 60)}\n`;
/**
 * A route file's note, as the routes evaluation words it: its own E code and message when the throw carries one, a
 * syntax error's E1000 line as is, else `failed`.
 */
const routeFailed = (file: string, e: unknown): string => {
  const code = codeOf(e);
  const message: unknown = Reflect.get(Object(e), "message");
  if (code !== undefined) return `${code} ${typeof message === "string" ? message : ""}\n`;
  const line = firstLine(e);
  return line.startsWith("E1000 ") ? `${line}\n` : failed(file, e);
};

type Load = { readonly file: string; readonly load: string };

/** The contract values among a module's exports. */
const contractsIn = (m: Readonly<Record<string, unknown>>): unknown[] =>
  Object.values(m).filter((v) => isRecord(v) && v.kind === "keel.contract");

/**
 * Binary only: `keel build`'s `.keel/surface.json` (k.compat Surface), written read-only as `{ data, hash }`. Each
 * app `modules/<m>/<m>.contract.ts` and `modules/<m>/routes.ts`, and each placed stdlib module's package `./contract`
 * and `./routes` (`stdContract`, `stdRoutes`, named by their real file), is evaluated in Node through a Vite SSR
 * server rooted at `cwd` (app files compiled by `@keel/compiler`, as the build evaluates them). `surfaceOf` reads the
 * contracts, the bindings of each `routes` route table (`bindingsOf` of the evaluated `@keel/router/internal`) and
 * the callers (`contractCallers`); the hash of every app file the evaluation read is recorded so `keel check` reports
 * a stale surface (E1005). A contract file that throws is a note `E1006 <file> failed to evaluate: <message>`,
 * records nothing and fails the build (code 1, no file written); a `routes.ts` or stdlib `./routes` that throws is
 * the same note naming that file, or the line the routes evaluation prints for it (k.compiler Build-time
 * evaluation: a thrown E code kept, a syntax error's E1000), so no surface lacks the routes of a file that failed.
 * The two internals load from the project, else from the CLI's own dependencies, so an app need not list
 * `@keel/store`; a failure of the evaluator itself (either not loading) is code 1. A project with neither file writes
 * an empty surface without starting the server.
 */
export async function surfaceRun(cwd: string): Promise<{ code: number; notes: string[] }> {
  const root = realpathSync(cwd);
  const files = readProject(root, "query").filter((f) => isSourcePath(f.path));
  const text = new Map(files.map((f) => [f.path, f.source]));
  const rel = (id: string): string | undefined => {
    const r = relative(root, id.split("?")[0] ?? id);
    return text.has(r) ? r : undefined;
  };
  const sources: Record<string, string> = {};
  const notes: string[] = [];
  const topologyFile = join(root, "topology.ts");
  const placed = existsSync(topologyFile)
    ? [...new Set(Object.values(parseTopology(readFileSync(topologyFile, "utf8")).topology).flatMap((d) => d.modules))]
    : [];
  const app = (f: { path: string }): boolean => {
    const m = CONTRACT.exec(f.path);
    return m !== null && m[1] === m[2];
  };
  const std = (find: typeof stdRoutes): Load[] =>
    placed.flatMap((m) => {
      const at = find(root, m);
      return at === undefined ? [] : [{ file: at[0], load: at[0] }];
    });
  const contractFiles: Load[] = [
    ...files.filter(app).map((f) => ({ file: f.path, load: `/${f.path}` })),
    ...std(stdContract),
  ];
  const routeFiles: Load[] = [
    ...files.filter((f) => ROUTES.test(f.path)).map((f) => ({ file: f.path, load: `/${f.path}` })),
    ...std(stdRoutes),
  ];
  const contracts: unknown[] = [];
  const bindings: unknown[] = [];
  let shapes: unknown;
  try {
    const server =
      contractFiles.length + routeFiles.length === 0
        ? undefined
        : await createViteServer({
            root,
            configFile: false,
            logLevel: "silent",
            appType: "custom",
            server: { middlewareMode: true, hmr: false, watch: null },
            optimizeDeps: { noDiscovery: true, include: [] },
            plugins: [
              {
                name: "keel-surface",
                enforce: "pre",
                transform(code, id) {
                  const path = rel(id);
                  if (path === undefined) return null;
                  sources[path] = hashOf(text.get(path) ?? code);
                  const out = compile([{ path, source: code }]);
                  const broken = out.diagnostics.find((d) => d.code === "E1000");
                  if (broken !== undefined)
                    throw new Error(`E1000 ${path}:${broken.line}:${broken.col} ${broken.message}`);
                  return out.outputs[0]?.code ?? null;
                },
              },
            ],
          });
    try {
      const broken = new Set<string>();
      for (const f of contractFiles) {
        const m: unknown = await server?.ssrLoadModule(f.load).catch((e: unknown) => {
          broken.add(f.file);
          notes.push(failed(f.file, e));
        });
        if (isRecord(m)) contracts.push(...contractsIn(m));
      }
      const tables: unknown[] = [];
      for (const f of routeFiles) {
        if (broken.size > 0) break;
        const m: unknown = await server?.ssrLoadModule(f.load).catch((e: unknown) => {
          notes.push(routeFailed(f.file, e));
        });
        if (isRecord(m) && isRecord(m.routes) && m.routes.kind === "keel.routeTable") tables.push(m.routes);
      }
      const internal: unknown =
        tables.length === 0 ? undefined : await server?.ssrLoadModule(kernel("@keel/router/internal", root));
      const bindingsOf = isRecord(internal) ? internal.bindingsOf : undefined;
      for (const t of tables) {
        const cs = isRecord(t) && Array.isArray(t.contracts) ? t.contracts : [];
        contracts.push(...cs);
        if (typeof bindingsOf !== "function") continue;
        let bound: unknown;
        try {
          bound = bindingsOf(t);
        } catch {
          bound = undefined;
        }
        if (bound instanceof Map) for (const b of bound.values()) if (isRecord(b)) bindings.push(b.binding);
      }
      const kept: unknown =
        bindings.length === 0 ? undefined : await server?.ssrLoadModule(kernel("@keel/store/internal", root));
      shapes = isRecord(kept) ? kept.storeShapes : undefined;
    } finally {
      await server?.close();
    }
    if (notes.length > 0) return { code: 1, notes };
    const storesOf = (factory: unknown): unknown => (typeof shapes === "function" ? shapes(factory) : undefined);
    const data = surfaceOf({ contracts, bindings, callers: contractCallers(files), storesOf, sources });
    const content = `${canonicalJson({ data, hash: hashOf(data) })}\n`;
    applyWrites(root, [{ path: ".keel/surface.json", content, readonly: true }]);
    return { code: 0, notes };
  } catch (e) {
    return { code: 1, notes: [...notes, `${firstLine(e)}\n`] };
  }
}
