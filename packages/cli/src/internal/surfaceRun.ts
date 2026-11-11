import { realpathSync } from "node:fs";
import { relative } from "node:path";
import { compile, isSourcePath } from "@keel/compiler";
import { createViteServer } from "vitest/node";
import { applyWrites } from "./applyWrites.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { hashOf } from "./hashOf.ts";
import { isRecord } from "./isRecord.ts";
import { readProject } from "./readProject.ts";
import { surfaceOf } from "./surfaceOf.ts";

/** The global the evaluated `service` stand-in reports each call to (build time only). */
const RECORD = Symbol.for("keel.surface.service");
/** Virtual `@keel/services` seen by one app file: the real module, with `service` recording its options. */
const STUB = "\0keel-surface-services:";
const ROUTES = /^modules\/[^/]+\/routes\.tsx?$/;
const CALLS = /@keel\/services/;
const MODULE_KEY = /\bmodule\s*:/;
const firstLine = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";

/**
 * Binary only: `keel build`'s `.keel/surface.json` (k.compat Surface), written read-only as `{ data, hash }`. Each
 * `modules/<m>/routes.ts` and each app file that calls `service({ module })` from `@keel/services` is evaluated in
 * Node through a Vite SSR server rooted at `cwd` (app files compiled by `@keel/compiler`, as the build evaluates
 * them); `service` is replaced by a stand-in that records its options and calls nothing. `surfaceOf` reads the result;
 * the hash of every app file the evaluation read is recorded so `keel check` reports a stale surface (E1005). An
 * endpoints file that throws is `E1006 <file> failed to evaluate: <message>` on stderr and contributes nothing (a
 * throwing `routes.ts` is reported by the routes evaluation); a failure of the evaluator itself is code 1. A project
 * with neither writes an empty surface without starting the server.
 */
export async function surfaceRun(cwd: string): Promise<{ code: number; notes: string[] }> {
  const root = realpathSync(cwd);
  const files = readProject(root, "query").filter((f) => isSourcePath(f.path));
  const text = new Map(files.map((f) => [f.path, f.source]));
  const rel = (id: string): string | undefined => {
    const r = relative(root, id.split("?")[0] ?? id);
    return text.has(r) ? r : undefined;
  };
  const calls: { file: string; opts: unknown }[] = [];
  const sources: Record<string, string> = {};
  const notes: string[] = [];
  const routeFiles = files.filter((f) => ROUTES.test(f.path));
  const callerFiles = files.filter((f) => CALLS.test(f.source) && MODULE_KEY.test(f.source));
  const manifests: { file: string; routes: unknown }[] = [];
  let table: unknown;
  Reflect.set(globalThis, RECORD, (file: string, opts: unknown) => void calls.push({ file, opts }));
  try {
    const server =
      routeFiles.length + callerFiles.length === 0
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
                resolveId: (id, importer) =>
                  id === "@keel/services" && importer !== undefined && rel(importer) !== undefined
                    ? `${STUB}${importer}`
                    : null,
                load(id) {
                  if (!id.startsWith(STUB)) return null;
                  const file = JSON.stringify(rel(id.slice(STUB.length)) ?? "");
                  return `export * from "@keel/services";\nexport const service = (opts) => (globalThis[Symbol.for("keel.surface.service")](${file}, opts), {});\n`;
                },
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
      for (const f of routeFiles) {
        const m: unknown = await server?.ssrLoadModule(`/${f.path}`).catch(() => undefined);
        if (isRecord(m)) manifests.push({ file: f.path, routes: m.routes });
      }
      const internal: unknown =
        manifests.length === 0
          ? undefined
          : await server?.ssrLoadModule("@keel/router/internal").catch(() => undefined);
      table = isRecord(internal) ? internal.routeActions : undefined;
      for (const f of callerFiles) {
        await server?.ssrLoadModule(`/${f.path}`).catch((e: unknown) => {
          notes.push(`E1006 ${f.path} failed to evaluate: ${firstLine(e).slice(0, 60)}\n`);
        });
      }
    } finally {
      await server?.close();
    }
    const actionsOf = (def: object): unknown => (table instanceof WeakMap ? table.get(def) : undefined);
    const data = surfaceOf({ manifests, actionsOf, services: calls, sources });
    const content = `${canonicalJson({ data, hash: hashOf(data) })}\n`;
    applyWrites(root, [{ path: ".keel/surface.json", content, readonly: true }]);
    return { code: 0, notes };
  } catch (e) {
    return { code: 1, notes: [...notes, `${firstLine(e)}\n`] };
  } finally {
    Reflect.deleteProperty(globalThis, RECORD);
  }
}
