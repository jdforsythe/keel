import { existsSync, readFileSync, realpathSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, contractCallers, isSourcePath, parseTopology } from "@keel/compiler";
import { sourceHash } from "@keel/compiler/internal";
import { entryDependency } from "@keel/compiler/internal/entry/entryDependency";
import { appLibraries } from "@keel/compiler/std/appLibraries";
import { libraryRel } from "@keel/compiler/std/libraryRel";
import { stdContract } from "@keel/compiler/std/stdContract";
import { stdRoutes } from "@keel/compiler/std/stdRoutes";
import { createViteServer } from "vitest/node";
import type { JsonSchema } from "./JsonSchema.ts";
import { applyWrites } from "./applyWrites.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { hashOf } from "./hashOf.ts";
import { isRecord } from "./isRecord.ts";
import { readProject } from "./readProject.ts";
import { surfaceOf } from "./surfaceOf.ts";

const CONTRACT = /^modules\/([^/]+)\/([^/]+)\.contract\.ts$/;
const ROUTES = /^modules\/[^/]+\/routes\.tsx?$/;
/** This package's JSON Schema writer, loaded in the evaluation's graph: `.ts` in the source, `.js` as built. */
const TO_JSON_SCHEMA = fileURLToPath(
  new URL(`./toJsonSchema${extname(fileURLToPath(import.meta.url))}`, import.meta.url),
);
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
  if (code !== undefined) {
    const text = typeof message === "string" ? message : "";
    return text.startsWith(`${code} `) ? `${text}\n` : `${code} ${text}\n`;
  }
  const line = firstLine(e);
  return line.startsWith("E1000 ") ? `${line}\n` : failed(file, e);
};

type Load = { readonly file: string; readonly load: string };
type Level = { readonly route: string; readonly name: string; readonly factory: unknown };

/** The `stores` factory a binding's `loader` names, else none. */
const factoryOf = (binding: Readonly<Record<string, unknown>> | undefined): unknown => {
  const l = binding?.loader;
  return isRecord(l) && typeof l.stores === "function" ? l.stores : undefined;
};

/**
 * Each bound route's chain of loaders naming `stores` (k.server E1550), outermost first, following each binding's
 * `layout` through `byId` (the evaluated bindings of every route table).
 */
function chainsOf(byId: ReadonlyMap<string, Readonly<Record<string, unknown>>>): Level[][] {
  return [...byId.keys()].map((id) => {
    const levels: Level[] = [];
    const seen = new Set<string>();
    for (let at: string | undefined = id; at !== undefined && !seen.has(at); ) {
      seen.add(at);
      const binding = byId.get(at);
      const factory = factoryOf(binding);
      if (typeof factory === "function") levels.unshift({ route: at, name: factory.name, factory });
      const up = binding?.layout;
      at = typeof up === "string" ? up : undefined;
    }
    return levels;
  });
}

/** The contract values among a module's exports. */
const contractsIn = (m: Readonly<Record<string, unknown>>): unknown[] =>
  Object.values(m).filter((v) => isRecord(v) && v.kind === "keel.contract");

/**
 * Binary only: `keel build`'s `.keel/surface.json` (k.compat Surface), written read-only as `{ data, hash }`. Each
 * app `modules/<m>/<m>.contract.ts` and `modules/<m>/routes.ts`, and each placed stdlib module's package `./contract`
 * and `./routes` (`stdContract`, `stdRoutes`, named by their real file), is evaluated in Node through a Vite SSR
 * server rooted at `cwd` (app files and the app's libraries' files, resolved with the `keel` condition, compiled by
 * `@keel/compiler`, as the build evaluates them; k.library In an app). `surfaceOf` reads the
 * contracts, the bindings of each `routes` route table (`bindingsOf` of the evaluated `@keel/router/internal`) and
 * the callers (`contractCallers`); the hash of every app file the evaluation read is recorded so `keel check` reports
 * a stale surface (E1005). A contract file that throws is a note `E1006 <file> failed to evaluate: <message>`,
 * records nothing and fails the build (code 1, no file written); a `routes.ts` or stdlib `./routes` that throws is
 * the same note naming that file, or the line the routes evaluation prints for it (k.compiler Build-time
 * evaluation: a thrown E code kept, a syntax error's E1000), so no surface lacks the routes of a file that failed.
 * The evaluated bindings' route chains are judged for E1550 (`storeIdClashes` of `@keel/store/internal`, each `stores`
 * factory run once on a sim ctx): each clash is a note `E1550 <message>` and fails the build.
 * The two internals load from the project, else from the CLI's own dependencies, so an app need not list
 * `@keel/store`; a failure of the evaluator itself (either not loading) is code 1. A project with neither file writes
 * an empty surface without starting the server.
 */
export async function surfaceRun(cwd: string): Promise<{ code: number; notes: string[] }> {
  const root = realpathSync(cwd);
  const files = readProject(root, "query").filter((f) => isSourcePath(f.path));
  const text = new Map(files.map((f) => [f.path, f.source]));
  const libraries = appLibraries(root);
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
  const byId = new Map<string, Readonly<Record<string, unknown>>>();
  let shapes: unknown;
  let schemaJson: (x: unknown) => JsonSchema | null = () => null;
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
            ssr: {
              resolve: { conditions: ["keel", "module", "node", "development|production"] },
              noExternal: libraries.map((l) => l.name),
            },
            plugins: [
              {
                name: "keel-surface",
                enforce: "pre",
                transform(code, id) {
                  const lib = libraryRel(libraries, id.split("?")[0] ?? id);
                  if (lib !== undefined) return compile([{ path: lib, source: code }]).outputs[0]?.code ?? null;
                  const path = rel(id);
                  if (path === undefined) return null;
                  sources[path] = sourceHash(path, text.get(path) ?? code) ?? "unparsed";
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
        if (bound instanceof Map)
          for (const [id, b] of bound)
            if (isRecord(b)) {
              bindings.push(b.binding);
              if (typeof id === "string" && isRecord(b.binding)) byId.set(id, b.binding);
            }
      }
      const kept: unknown =
        bindings.length === 0 ? undefined : await server?.ssrLoadModule(kernel("@keel/store/internal", root));
      shapes = isRecord(kept) ? kept.storeShapes : undefined;
      // A schema the app's modules made is known only to the evaluation of `@keel/schema` that made it (k.realm):
      // the graph's own `isSchema` and this package's `toJsonSchema`, loaded in that graph, read it.
      const schemaMod: unknown = await server?.ssrLoadModule(kernel("@keel/schema", root));
      const jsonMod: unknown = await server?.ssrLoadModule(TO_JSON_SCHEMA);
      const isSchemaIn = isRecord(schemaMod) ? schemaMod.isSchema : undefined;
      const toJsonIn = isRecord(jsonMod) ? jsonMod.toJsonSchema : undefined;
      if (typeof isSchemaIn === "function" && typeof toJsonIn === "function")
        schemaJson = (x) => {
          if (Reflect.apply(isSchemaIn, undefined, [x]) !== true) return null;
          const out: unknown = Reflect.apply(toJsonIn, undefined, [Reflect.get(Object(x), "node")]);
          return isRecord(out) ? out : null;
        };
      const clashes = isRecord(kept) ? kept.storeIdClashes : undefined;
      if (typeof clashes === "function")
        for (const m of clashes(chainsOf(byId))) if (typeof m === "string") notes.push(`E1550 ${m}\n`);
    } finally {
      await server?.close();
    }
    if (notes.length > 0) return { code: 1, notes };
    const storesOf = (factory: unknown): unknown => (typeof shapes === "function" ? shapes(factory) : undefined);
    const data = surfaceOf({ contracts, bindings, callers: contractCallers(files), storesOf, sources, schemaJson });
    const content = `${canonicalJson({ data, hash: hashOf(data) })}\n`;
    applyWrites(root, [{ path: ".keel/surface.json", content, readonly: true }]);
    return { code: 0, notes };
  } catch (e) {
    return { code: 1, notes: [...notes, `${firstLine(e)}\n`] };
  }
}
