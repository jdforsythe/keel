import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { s } from "@keel/schema";
import { build } from "esbuild";
import { compile } from "../compile.ts";
import { shippedTokensPlugin } from "../hosting/shippedTokensPlugin.ts";
import { appLibraries } from "../std/appLibraries.ts";
import { libraryRel } from "../std/libraryRel.ts";
import type { RouteEntry } from "../types/RouteEntry.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";
import { contractOf } from "./contractOf.ts";
import { internalFailure } from "./internalFailure.ts";

// Build-time only (D24): the bundle below is resolved from the app root, which depends on these packages.
const UI_CSS = "@keel/ui/css";
const ROUTER = "@keel/router";

const REQUIRE_BANNER =
  "import { createRequire as keelCreateRequire } from 'node:module'; const require = keelCreateRequire(import.meta.url);";

const SERVER_ENV = JSON.stringify({ BASE_URL: "/", MODE: "production", DEV: false, PROD: true, SSR: true });

const q = (s: string): string => JSON.stringify(s);
/** An import specifier for a root-relative or absolute file. */
const spec = (f: string): string => q(path.isAbsolute(f) ? f : `./${f}`);

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isNullableString = (x: unknown): x is string | null => x === null || typeof x === "string";

const Json = s.json();

function isRouteEntry(x: unknown): x is RouteEntry {
  return (
    isRecord(x) &&
    Array.isArray(x.actions) &&
    x.actions.every((v) => typeof v === "string") &&
    isNullableString(x.guard) &&
    isNullableString(x.layout) &&
    typeof x.module === "string" &&
    isNullableString(x.path) &&
    (x.api === undefined || x.api === true) &&
    (x.method === undefined || typeof x.method === "string") &&
    Json.parse(x.params).ok &&
    Json.parse(x.search).ok
  );
}

/** Source of the evaluator entry: compiles the CSS and the routes artifact inside the app's own module graph. */
function entrySource(
  tokensFile: string | undefined,
  routesFiles: readonly (readonly [routes: string, contract: string | undefined])[],
  usages: readonly StyleUsage[],
) {
  const lines: string[] = [];
  if (tokensFile !== undefined) lines.push(`import { compileStyles, schemesOf } from ${q(UI_CSS)};`);
  if (routesFiles.length > 0) lines.push(`import { routesArtifact } from ${q(ROUTER)};`);
  lines.push(
    `const usages = ${JSON.stringify(usages)};`,
    "const problems = [];",
    "const internal = [];",
    "let css = '';",
    "let looks = {};",
    "let schemes = ['light'];",
    "const message = (e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e));",
    "const coded = (e) => e && typeof e === 'object' && 'code' in e && /^E[0-9]{4}$/.test(String(e.code));",
    // A diagnostic-shaped error keeps its code; any other throw from the compiler call is an internal failure.
    "const report = (e) => { if (coded(e)) problems.push(`${e.code} ${message(e)}`); else internal.push(message(e)); };",
  );
  if (tokensFile !== undefined)
    lines.push(
      "let tokens;",
      // The tokens module throwing while it evaluates means tokens.ts is unusable: E1807 unless it carries its own code.
      `try { const m = await import(${q(`./${tokensFile}`)}); tokens = m.tokens ?? m.default; }`,
      `catch (e) { problems.push(coded(e) ? \`\${e.code} \${message(e)}\` : \`E1807 ${tokensFile} failed to evaluate: \${message(e)}\`); }`,
      "const fits = (u) => { try { compileStyles({ tokens, usages: [u] }); return true; } catch (e) { report(e); return false; } };",
      `if (tokens === undefined && problems.length === 0) problems.push('E1807 ${tokensFile} exports no tokens');`,
      "else if (tokens !== undefined) {",
      "  if (tokens.look !== null && typeof tokens.look === 'object') looks = tokens.look;",
      "  try { schemes = [...schemesOf(tokens)]; } catch (e) { report(e); }",
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
      "    try { await loadContract(); }",
      "    catch (e) { problems.push(coded(e) ? `${e.code} ${message(e)}` : `E1006 ${contract} failed to evaluate: ${message(e)}`); return {}; }",
      "  }",
      "  let m;",
      "  try { m = await load(); }",
      "  catch (e) { problems.push(coded(e) ? `${e.code} ${message(e)}` : `E1006 ${file} failed to evaluate: ${message(e)}`); return {}; }",
      "  if (m.routes === undefined) { problems.push(`E1006 ${file} exports no routes`); return {}; }",
      "  try { if (m.routes === null || typeof m.routes !== 'object' || m.routes.kind !== 'keel.routeTable') { problems.push(`E1006 ${file} exports no route table`); return {}; } }",
      "  catch (e) { report(e); return {}; }",
      "  try { return routesArtifact(m.routes); } catch (e) { report(e); return {}; }",
      "};",
    );
  lines.push(
    `const routes = Object.assign({}, ${routesFiles.map(([f, c]) => `await manifest(${q(f)}, () => import(${spec(f)}), ${c === undefined ? "undefined, undefined" : `${q(c)}, () => import(${spec(c)})`})`).join(", ")});`,
    "export default JSON.stringify({ css, looks, schemes, problems: [...new Set(problems)], internal: [...new Set(internal)], routes });",
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
}): Promise<{
  css: string;
  looks: Readonly<Record<string, unknown>>;
  schemes: readonly string[];
  routes: Record<string, RouteEntry>;
  problems: string[];
}> {
  const { root } = input;
  if (input.tokensFile === undefined && input.routesFiles.length === 0)
    return { css: "", looks: {}, schemes: ["light"], routes: {}, problems: [] };
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
      ),
      resolveDir: root,
      sourcefile: "keel-evaluate.js",
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    // As the server build: a package's CommonJS `require` of a Node built-in (`pg` requires `events`) gets a real one.
    banner: { js: REQUIRE_BANNER },
    // As the server build: `import.meta.env` holds Vite's built-in values only (the plugin's `envPrefix` admits none).
    define: { "import.meta.env": SERVER_ENV },
    // Node's own conditions (`node`, `import`, `default`), without esbuild's `module`: the file a package's `exports`
    // gives here is the one Node imports and the one `routeLiterals` reads; `keel` first gives a library's source.
    conditions: ["keel"],
    target: "node20",
    logLevel: "silent",
    // A stylesheet a host element code file imports (k.host-code) is the browser build's asset: here it is nothing.
    loader: { ".css": "empty" },
    plugins: [
      shippedTokensPlugin(root),
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
            const r = compile([{ path: rel, source: fs.readFileSync(args.path, "utf8") }]);
            const broken = r.diagnostics.filter((d) => d.code === "E1000");
            if (broken.length > 0) {
              for (const d of broken) syntax.push(`E1000 ${d.path}:${d.line}:${d.col} ${d.message}`);
              return { errors: broken.map((d) => ({ text: d.message })) };
            }
            const out = r.outputs[0];
            return { contents: out?.code ?? "", loader: "ts", resolveDir: path.dirname(args.path) };
          });
        },
      },
    ],
  });
  const result = await bundled.catch((e: unknown) => {
    if (syntax.length > 0) return undefined;
    throw e;
  });
  if (result === undefined)
    return { css: "", looks: {}, schemes: ["light"], routes: {}, problems: [...new Set(syntax)] };
  const text = result.outputFiles[0]?.text ?? "";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-evaluate-"));
  const file = path.join(dir, "evaluate.mjs");
  let json: unknown;
  try {
    fs.writeFileSync(file, text);
    const mod: unknown = await import(pathToFileURL(file).href);
    json = isRecord(mod) && typeof mod.default === "string" ? JSON.parse(mod.default) : undefined;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
  const routes: Record<string, RouteEntry> = Object.create(null);
  for (const id of Object.keys(json.routes).sort()) {
    const entry = json.routes[id];
    if (isRouteEntry(entry)) routes[id] = entry;
  }
  const looks = isRecord(json.looks) ? json.looks : {};
  const schemes = Array.isArray(json.schemes) ? json.schemes.filter((x) => x === "light" || x === "dark") : ["light"];
  return { css: json.css, looks, schemes, routes, problems: json.problems.filter((p) => typeof p === "string") };
}
