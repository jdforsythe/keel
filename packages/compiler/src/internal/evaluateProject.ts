import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { EvaluateFailure } from "../EvaluateFailure.ts";
import { compile } from "../compile.ts";
import { evaluate } from "../evaluate.ts";
import { shippedTokensPlugin } from "../hosting/shippedTokensPlugin.ts";
import { appLibraries } from "../std/appLibraries.ts";
import { libraryRel } from "../std/libraryRel.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { RouteEntry } from "../types/RouteEntry.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";
import { OBSERVE_BANNER } from "./OBSERVE_BANNER.ts";
import type { Observed } from "./Observed.ts";
import type { ProblemRecord } from "./ProblemRecord.ts";
import { SERVER_ENV } from "./SERVER_ENV.ts";
import { UNRESOLVED_MARK } from "./UNRESOLVED_MARK.ts";
import { bundleFailure } from "./bundleFailure.ts";
import { censusPlugin } from "./censusPlugin.ts";
import { contractOf } from "./contractOf.ts";
import { evaluatorAnswers } from "./evaluatorAnswers.ts";
import { importMetaPlugin } from "./importMetaPlugin.ts";
import { internalFailure } from "./internalFailure.ts";
import { isNodeBuiltin } from "./isNodeBuiltin.ts";
import { observePlugin } from "./observePlugin.ts";
import { pathLinks } from "./pathLinks.ts";
import { placeRefusals } from "./placeRefusals.ts";
import { routeEntries } from "./routeEntries.ts";
import { withImportMeta } from "./withImportMeta.ts";

// Build-time only (D24): the bundle below is resolved from the app root, which depends on these packages.
const UI_CSS = "@keel/ui/css";
const ROUTER = "@keel/router";

const q = (s: string): string => JSON.stringify(s);

/**
 * The last compile of each app file a bundle loaded, by its absolute path: its project path, source, syntax errors and
 * the contents the bundle loads. `compile` of one file is a function of its path and source, so a later evaluation in the process (`keel
 * dev`'s refreshes) takes an entry whose path and source are unchanged instead of compiling again.
 */
const compiled = new Map<
  string,
  {
    readonly rel: string;
    readonly source: string;
    readonly broken: readonly Diagnostic[];
    /** What the bundle loads for the file: the compile's code with its own `import.meta` and its map inline. */
    readonly contents: string;
  }
>();
/**
 * The compile's source map of `file` as an inline comment, its one source named by the file's own name (esbuild reads
 * it beside the file), so a position in the bundle maps to the line of the source as written; none without a map.
 */
function inlineMap(map: string | undefined, file: string): string {
  if (map === undefined) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(map);
  } catch {
    return "";
  }
  if (typeof parsed !== "object" || parsed === null) return "";
  const named = { ...parsed, sources: [path.basename(file)], sourcesContent: undefined };
  return `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(named)).toString("base64")}`;
}

/** An import specifier for a root-relative or absolute file. */
const spec = (f: string): string => q(path.isAbsolute(f) ? f : `./${f}`);

/**
 * The surface part of an evaluation (k.compat Surface): contract files and route tables to import (root-relative or
 * absolute), the specifiers (bare, or absolute files) of `@keel/router/internal` and `@keel/store/internal` the bundle reads
 * them with, and `reader`, the absolute file of a module whose `surfaceRead` turns the live values into data inside
 * the evaluator (`{ surface, problems }`, each problem an E1550 message).
 */
type SurfaceInput = {
  readonly contracts: readonly string[];
  readonly tables: readonly string[];
  readonly router: string;
  readonly store: string;
  readonly reader: string;
};

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
/** A problem record of the entry's JSON (`ProblemRecord`), or none when it is out of shape. */
function recordOf(x: unknown): ProblemRecord[] {
  if (!isRecord(x) || typeof x.code !== "string") return [];
  const frames = Array.isArray(x.frames)
    ? x.frames.flatMap((f: unknown) =>
        Array.isArray(f) && typeof f[0] === "number" && typeof f[1] === "number" ? [pair(f[0], f[1])] : [],
      )
    : [];
  return [
    {
      code: x.code,
      message: typeof x.message === "string" ? x.message : undefined,
      what: typeof x.what === "string" ? x.what : undefined,
      frames,
    },
  ];
}
const pair = (line: number, col: number): readonly [number, number] => [line, col];

/**
 * An evaluation that gave no result as the error `deriveEvaluated` and the plugin report: a refusal placed as any
 * other (`placeRefusals`), any other failure `<code> <message>` (E1048 and E1049 name the entry file whose import had
 * not finished, `<code> <file> <message>`). Its message is that one problem line.
 */
function evaluatorFailure(f: EvaluateFailure, map: () => string | undefined, root: string): Error {
  // E1048 and E1049 lie at the file the entry was importing: `<code> <file> <the rest of the message>`.
  const file = f.file;
  if (file !== undefined && f.message.startsWith(file) && f.what === undefined) {
    const rest = f.message.slice(file.length).replace(/^:? /, "");
    return Object.assign(new Error(`${f.code} ${file} ${rest}`), { code: f.code });
  }
  const [line = `${f.code} ${f.message}`] = placeRefusals(
    [{ code: f.code, message: f.message, what: f.what, frames: f.frames }],
    map,
    root,
  );
  return Object.assign(new Error(line), { code: f.code });
}

/** Source of the evaluator entry: compiles the CSS and the routes artifact inside the app's own module graph. */
function entrySource(
  tokensFile: string | undefined,
  routesFiles: readonly (readonly [routes: string, contract: string | undefined])[],
  usages: readonly StyleUsage[],
  surface: SurfaceInput | undefined,
) {
  const lines: string[] = [];
  if (surface !== undefined)
    lines.push(
      `import * as keelRouterInternal from ${q(surface.router)};`,
      `import * as keelStoreInternal from ${q(surface.store)};`,
      `import { surfaceRead } from ${q(surface.reader)};`,
    );
  if (tokensFile !== undefined) lines.push(`import { compileStyles, schemesOf } from ${q(UI_CSS)};`);
  if (routesFiles.length > 0) lines.push(`import { routesArtifact } from ${q(ROUTER)};`);
  lines.push(
    `const usages = ${JSON.stringify(usages)};`,
    "const problems = [];",
    "const internal = [];",
    "let css = '';",
    "let looks = {};",
    "let schemes = ['light'];",
    "let themes = [];",
    "const message = (e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e));",
    "const coded = (e) => e && typeof e === 'object' && 'code' in e && /^E[0-9]{4}$/.test(String(e.code));",
    // A refusal is a record of its own (k.evaluator Placing); a diagnostic-shaped error keeps its code; any other throw
    // ends the file it came from with `code`, naming it.
    "const recordOf = (e, code, file) => { const r = __keelRefusalOf(e); if (r !== undefined) return { code: 'E1050', what: String(r.what), frames: r.frames }; if (coded(e)) { const m = message(e); return { code: String(e.code), message: m.startsWith(`${e.code} `) ? m.slice(String(e.code).length + 1) : m }; } return { code, message: `${file} failed to evaluate: ${message(e)}` }; };",
    // From the compiler call, a codeless throw that is no refusal is an internal failure.
    "const report = (e) => { if (__keelRefusalOf(e) !== undefined || coded(e)) problems.push(recordOf(e)); else internal.push(message(e)); };",
  );
  if (tokensFile !== undefined)
    lines.push(
      "let tokens;",
      // The tokens module throwing while it evaluates means tokens.ts is unusable: E1807 unless it carries its own code.
      `__keelAt(${q(tokensFile)});`,
      `try { const m = await import(${q(`./${tokensFile}`)}); tokens = m.tokens ?? m.default; }`,
      `catch (e) { problems.push(recordOf(e, 'E1807', ${q(tokensFile)})); }`,
      "const fits = (u) => { try { compileStyles({ tokens, usages: [u] }); return true; } catch (e) { report(e); return false; } };",
      `if (tokens === undefined && problems.length === 0) problems.push({ code: 'E1807', message: '${tokensFile} exports no tokens' });`,
      "else if (tokens !== undefined) {",
      "  if (tokens.look !== null && typeof tokens.look === 'object') looks = tokens.look;",
      "  try { schemes = [...schemesOf(tokens)]; } catch (e) { report(e); }",
      // The `choice` themes, in `themes` order (k.themes), for the first paint and `appearance(ctx)`.
      "  if (tokens.themes !== null && typeof tokens.themes === 'object') themes = Object.entries(tokens.themes).filter(([, t]) => t !== null && typeof t === 'object' && (t.when === undefined || t.when === 'choice')).map(([n]) => n);",
      "  try { css = compileStyles({ tokens, usages }).css; }",
      "  catch { try { css = compileStyles({ tokens, usages: usages.filter(fits) }).css; } catch (e) { report(e); } }",
      "}",
    );
  // Each contract and routes.ts is imported dynamically so its throw is catchable: E1006 unless it carries its own
  // code. A contract that throws is reported once and its binding is not run (it would read the failed module).
  if (routesFiles.length > 0)
    lines.push(
      "const manifest = async (file, load, contract, loadContract) => {",
      "  if (contract !== undefined) {",
      "    __keelAt(contract);",
      "    try { await loadContract(); }",
      "    catch (e) { problems.push(recordOf(e, 'E1006', contract)); return {}; }",
      "  }",
      "  let m;",
      "  __keelAt(file);",
      "  try { m = await load(); }",
      "  catch (e) { problems.push(recordOf(e, 'E1006', file)); return {}; }",
      "  if (m.routes === undefined) { problems.push({ code: 'E1006', message: `${file} exports no routes` }); return {}; }",
      "  try { if (m.routes === null || typeof m.routes !== 'object' || m.routes.kind !== 'keel.routeTable') { problems.push({ code: 'E1006', message: `${file} exports no route table` }); return {}; } }",
      "  catch (e) { report(e); return {}; }",
      "  try { return routesArtifact(m.routes); } catch (e) { report(e); return {}; }",
      "};",
    );
  // The surface (k.compat Surface), read inside the evaluator from every contract a contract file or route table holds,
  // each route table, and the two internals that read bindings and store shapes (`surfaceRead`); a file that throws is
  // E1006 naming it.
  if (surface !== undefined)
    lines.push(
      "const surfaceContracts = [];",
      "const surfaceTables = [];",
      "const isContract = (v) => v !== null && typeof v === 'object' && v.kind === 'keel.contract';",
      ...surface.contracts.map(
        (f) =>
          `__keelAt(${q(f)}); try { surfaceContracts.push(...Object.values(await import(${spec(f)})).filter(isContract)); } catch (e) { problems.push(recordOf(e, 'E1006', ${q(f)})); }`,
      ),
      // A contract that throws is reported once: no route table is imported after it (each would read it again).
      "const surfaceBroken = problems.length > 0;",
      ...surface.tables.map(
        (f) =>
          `if (!surfaceBroken) { __keelAt(${q(f)}); try { const m = await import(${spec(f)}); if (m.routes !== null && typeof m.routes === 'object' && m.routes.kind === 'keel.routeTable') surfaceTables.push(m.routes); } catch (e) { problems.push(recordOf(e, 'E1006', ${q(f)})); } }`,
      ),
      "let surface;",
      "try { const read = surfaceRead({ contracts: surfaceContracts, tables: surfaceTables, router: keelRouterInternal, store: keelStoreInternal }); surface = read.surface; for (const m of read.problems) problems.push({ code: 'E1550', message: String(m) }); }",
      "catch (e) { problems.push(recordOf(e, 'E1006', 'the surface')); }",
    );
  lines.push(
    `const routes = Object.assign({}, ${routesFiles.map(([f, c]) => `await manifest(${q(f)}, () => import(${spec(f)}), ${c === undefined ? "undefined, undefined" : `${q(c)}, () => import(${spec(c)})`})`).join(", ")});`,
    `export default JSON.stringify({ css, looks, schemes, themes, problems, internal: [...new Set(internal)], routes${surface === undefined ? "" : ", surface"} });`,
  );
  return lines.join("\n");
}

/**
 * Evaluate the app's `tokens.ts`, contracts and `routes.ts` bindings at build time (D24): bundle a generated entry with
 * esbuild from `root` (app modules under `root` and the app's libraries' files, resolved with the `keel` condition, go
 * through `compile`, as in Vite (k.library In an app); other packages are bundled as is, with a
 * `require` from `createRequire` as the server build has), run its module top levels once in Node, and read back the atomic CSS (`compileStyles` from `@keel/ui/css` over `usages`), the tokens' `look` sets as data, their color schemes (`schemesOf`, k.schemes; `['light']` without tokens) and the merged
 * `routes.json` (`routesArtifact` from `@keel/router` per manifest). Usages with an unknown token are left out
 * of the CSS and listed in `problems` (E1801; `keel check` reports them at their source). Error mapping (k.compiler
 * Build-time evaluation): a diagnostic-shaped error keeps its `code`; `tokens.ts` throwing while it evaluates, or
 * exporting no tokens, is E1807 (k.ui); a contract file (`contractOf`, evaluated before its binding) throwing, or a
 * `routes.ts` throwing or exporting no `routes` or a `routes` that is no route table, is E1006 naming that file (the module contributes no routes); a syntax error in any evaluated app module is E1000 at its location, with no CSS or routes;
 * any other codeless throw from the compiler side rejects with E1049 (`internalFailure`), never an app code.
 */
export async function evaluateProject(input: {
  readonly root: string;
  readonly tokensFile: string | undefined;
  readonly routesFiles: readonly string[];
  readonly usages: readonly StyleUsage[];
  readonly surface?: SurfaceInput | undefined;
  readonly signal?: AbortSignal | undefined;
}): Promise<{
  css: string;
  looks: Readonly<Record<string, unknown>>;
  schemes: readonly string[];
  themes: readonly string[];
  routes: Record<string, RouteEntry>;
  problems: string[];
  /** The absolute path of every file the bundle loaded (esbuild's inputs), sorted; none when nothing was bundled. */
  inputs?: string[];
  /**
   * What the bundle's code has asked so far of the file system, the environment and the process (`Observed`), with
   * what the bundle's resolver asked (`pathLinks`): each candidate and `node_modules/<name>` it tried, each symbolic
   * link on a path to a file loaded or read among its probes, and the nearest `package.json` and `tsconfig.json` of
   * each loaded file's folder among its reads; read after the last of its code has run.
   */
  observe?: () => Observed;
  /** With `surface`: the surface's data without its callers (k.compat Surface), as `surfaceRead` gave it. */
  surface?: unknown;
}> {
  const { root } = input;
  const surfaceInput = input.surface;
  const none = surfaceInput === undefined || surfaceInput.contracts.length + surfaceInput.tables.length === 0;
  if (input.tokensFile === undefined && input.routesFiles.length === 0 && none)
    return { css: "", looks: {}, schemes: ["light"], themes: [], routes: {}, problems: [] };
  // The tokens module is imported dynamically (so its throw is catchable), which esbuild treats as optional.
  if (input.tokensFile !== undefined && !fs.existsSync(path.join(root, input.tokensFile)))
    throw new Error(`keel: Could not resolve "./${input.tokensFile}" (tokens file)`);
  const syntax: string[] = [];
  const libraries = appLibraries(root);
  const bundled = build({
    stdin: {
      contents: entrySource(
        input.tokensFile,
        input.routesFiles.map((f) => [f, contractOf(root, f)] as const),
        input.usages,
        none ? undefined : surfaceInput,
      ),
      resolveDir: root,
      sourcefile: "keel-evaluate.js",
      loader: "js",
    },
    bundle: true,
    write: false,
    metafile: true,
    absWorkingDir: root,
    format: "esm",
    platform: "node",
    // As the server build: a package's CommonJS `require` of a Node built-in (`pg` requires `events`) gets one, here
    // the bundle's own (`OBSERVE_BANNER`), whose views ask the command, which records each question.
    banner: { js: OBSERVE_BANNER },
    // As the server build: `import.meta.env` holds Vite's built-in values only (the plugin's `envPrefix` admits none).
    // Every other `import.meta` is its module's own (`withImportMeta`). Free global names are the evaluator's own global
    // object's, which the banner prepares (k.evaluator Realm).
    define: {
      "import.meta.env": JSON.stringify(SERVER_ENV),
      "import.meta": "__keelMeta",
    },
    // The map places an E1050 at the refused call's own file and line (`placeRefusals`).
    sourcemap: "external",
    sourcesContent: false,
    outfile: path.join(root, "keel-evaluate.mjs"),
    // A literal `import()` is bundled; a computed one becomes the bundle's own `require` (`OBSERVE_BANNER`), never
    // Node's loader.
    supported: { "dynamic-import": false },
    // Node's own conditions (`node`, `import`, `default`), without esbuild's `module`: the file a package's `exports`
    // gives here is the one Node imports and the one `routeLiterals` reads; `keel` first gives a library's source.
    conditions: ["keel"],
    target: "node20",
    logLevel: "silent",
    // A stylesheet a host element code file imports (k.host-code) is the browser build's asset: here it is nothing.
    loader: { ".css": "empty" },
    plugins: [
      observePlugin(),
      shippedTokensPlugin(root),
      censusPlugin(),
      {
        name: "keel-jsx",
        setup(b) {
          // A query import (`./notes.md?raw`, `?url`) is Vite's: here `?raw` is the file's text, any other an empty string.
          b.onResolve({ filter: /\?/ }, (args) => ({
            path: path.resolve(args.resolveDir, args.path.split("?")[0] ?? ""),
            namespace: "keel-query",
            pluginData: args.path.endsWith("?raw"),
          }));
          b.onLoad({ filter: /.*/, namespace: "keel-query" }, (args) => ({
            contents: args.pluginData === true ? fs.readFileSync(args.path, "utf8") : "",
            loader: "text",
          }));
          b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => {
            const own = path.relative(root, args.path).split(path.sep).join("/");
            const rel = libraryRel(libraries, args.path) ?? own;
            if (rel.startsWith("../") || path.isAbsolute(rel) || rel.split("/").includes("node_modules"))
              return undefined;
            const source = fs.readFileSync(args.path, "utf8");
            let c = compiled.get(args.path);
            if (c === undefined || c.rel !== rel || c.source !== source) {
              const r = compile([{ path: rel, source }]);
              const code = r.outputs[0]?.code ?? "";
              const map = r.outputs[0]?.map;
              c = {
                rel,
                source,
                broken: r.diagnostics.filter((d) => d.code === "E1000"),
                contents: `${withImportMeta(code, args.path)}${inlineMap(map, args.path)}`,
              };
              compiled.set(args.path, c);
            }
            const broken = c.broken;
            if (broken.length > 0) {
              for (const d of broken) syntax.push(`E1000 ${d.path}:${d.line}:${d.col} ${d.message}`);
              return { errors: broken.map((d) => ({ text: d.message })) };
            }
            return {
              contents: c.contents,
              loader: "ts",
              resolveDir: path.dirname(args.path),
            };
          });
        },
      },
      importMetaPlugin(),
    ],
  });
  const result = await bundled.catch((e: unknown) => {
    if (syntax.length > 0) return undefined;
    throw bundleFailure(e, root);
  });
  if (result === undefined)
    return { css: "", looks: {}, schemes: ["light"], themes: [], routes: {}, problems: [...new Set(syntax)] };
  // A metafile input is relative to `root`, or `<namespace>:<path>` for a plugin's namespace; the entry and esbuild's
  // own `<define:...>` inputs are no files.
  const inputs = [
    ...new Set(
      Object.keys(result.metafile.inputs).flatMap((k) => {
        const at = path.resolve(root, /^[a-z-]+:/.test(k) ? k.slice(k.indexOf(":") + 1) : k);
        return k.includes("<") || k === "keel-evaluate.js" || !fs.existsSync(at) ? [] : [at];
      }),
    ),
  ].sort();
  // The names left to run time because none resolved from their importer (a `require` in a `try`): the bundle's free
  // `require` answers them not found, and `pathLinks` records the questions that resolution asked.
  const unresolved = [
    ...new Set(
      Object.values(result.metafile.inputs).flatMap((i) =>
        i.imports.filter((x) => x.external === true && !isNodeBuiltin(x.path)).map((x) => x.path),
      ),
    ),
  ].sort();
  const js = result.outputFiles.find((f) => f.path.endsWith(".mjs"));
  const map = (): string | undefined => result.outputFiles.find((f) => f.path.endsWith(".map"))?.text;
  const text = (js?.text ?? "").replace(UNRESOLVED_MARK, () => JSON.stringify(unresolved));
  // The bundle runs in an evaluator (k.evaluator), alone in a folder of its own; the command answers and records.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-evaluate-")));
  const asked = evaluatorAnswers();
  let out: Awaited<ReturnType<typeof evaluate>>;
  try {
    const file = path.join(dir, "evaluate.mjs");
    fs.writeFileSync(file, text);
    out = await evaluate({
      kind: "data",
      entry: file,
      answer: asked.answer,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (out instanceof EvaluateFailure) throw evaluatorFailure(out, map, root);
  const json: unknown = typeof out.default === "string" ? JSON.parse(out.default) : undefined;
  if (
    !isRecord(json) ||
    typeof json.css !== "string" ||
    !isRecord(json.routes) ||
    !Array.isArray(json.problems) ||
    !Array.isArray(json.internal)
  )
    throw internalFailure("build-time evaluation returned no result");
  const internal = json.internal.filter((p) => typeof p === "string");
  if (internal.length > 0) throw internalFailure(`build-time evaluation: ${internal.join("; ")}`);
  const routes = routeEntries(json.routes);
  const looks = isRecord(json.looks) ? json.looks : {};
  const schemes = Array.isArray(json.schemes) ? json.schemes.filter((x) => x === "light" || x === "dark") : ["light"];
  const problems = [...new Set(placeRefusals(json.problems.flatMap(recordOf), map, root))];
  const observe = (): Observed => {
    const o = asked.observed();
    const links = pathLinks(root, result.metafile, o.reads);
    return { ...o, reads: [...new Set([...o.reads, ...links.files])], probes: [...o.probes, ...links.probes] };
  };
  const surface: unknown = json.surface;
  const themes = Array.isArray(json.themes) ? json.themes.filter((x) => typeof x === "string") : [];
  return { css: json.css, looks, schemes, themes, routes, problems, inputs, observe, ...(none ? {} : { surface }) };
}
